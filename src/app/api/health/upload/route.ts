import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { healthDb, type HealthUser } from "@/lib/healthDb";
import { extractPdfText } from "@/lib/pdfText";
import { extractDocument, flagFromRef } from "@/lib/healthExtract";
import { normalizeMarker } from "@/lib/healthMarkers";
import { hasKey } from "@/lib/timeweb";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 12 * 1024 * 1024; // 12 МБ
const MIN_TEXT = 180; // меньше — почти наверняка скан или фото

export async function POST(req: NextRequest) {
  const user = (await getCurrentUser().catch(() => null)) as (HealthUser & { id: string }) | null;
  if (!user) return Response.json({ error: "auth", text: "Нужно войти." }, { status: 401 });
  if (!user.healthEnabled) {
    return Response.json({ error: "no_consent", text: "Нужно согласие на медицинские данные." }, { status: 403 });
  }
  if (!hasKey()) {
    return Response.json({ error: "no_key", text: "Разбор недоступен: ключ модели не задан." }, { status: 503 });
  }

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("file");
    if (f instanceof File) file = f;
  } catch {
    return Response.json({ error: "bad_request", text: "Не получилось прочитать файл." }, { status: 400 });
  }
  if (!file) return Response.json({ error: "no_file", text: "Файл не пришёл." }, { status: 400 });

  const name = file.name || "документ.pdf";
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(name);
  if (!isPdf) {
    return Response.json(
      {
        error: "not_pdf",
        text: "Пока я умею читать только PDF. Обычно его можно скачать в личном кабинете лаборатории 🤍",
      },
      { status: 415 },
    );
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "too_big", text: "Файл больше 12 МБ — пришли, пожалуйста, поменьше." }, { status: 413 });
  }

  // 1. Достаём текст. Файл не сохраняем — только текст и разобранные показатели.
  let text = "";
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const res = await extractPdfText(buf);
    text = res.text;
  } catch (e) {
    console.error("[health/upload] не удалось прочитать PDF:", e);
    return Response.json({ error: "pdf_failed", text: "Не получилось прочитать этот PDF." }, { status: 422 });
  }

  if (text.length < MIN_TEXT) {
    return Response.json(
      {
        error: "no_text",
        text:
          "Похоже, это скан или фотография: текста внутри нет, а распознавать картинки я пока не умею. " +
          "Попробуй скачать PDF с текстом из личного кабинета лаборатории 🤍",
      },
      { status: 422 },
    );
  }

  // 2. Разбираем — строго по напечатанному.
  const parsed = await extractDocument(text);
  if (!parsed) {
    return Response.json({ error: "parse_failed", text: "Не получилось разобрать документ. Попробуй ещё раз." }, { status: 422 });
  }

  const takenAt = parsed.docDate ? new Date(parsed.docDate + "T00:00:00Z") : null;

  // 3. Сохраняем документ.
  const doc = await healthDb.doc().create({
    data: {
      userId: user.id,
      kind: parsed.kind,
      title: parsed.title,
      docDate: takenAt,
      lab: parsed.lab,
      fileName: name,
      textRaw: text.slice(0, 60000),
      summary: parsed.summary,
      status: "parsed",
    },
  });

  // 4. Показатели с нормализованным ключом — чтобы сравнивать между документами.
  const rows = parsed.markers.map((m) => {
    const { code, label } = normalizeMarker(m.name);
    return {
      userId: user.id,
      docId: doc.id,
      code,
      name: label || m.name,
      value: m.value,
      valueText: m.valueText,
      unit: m.unit,
      refLow: m.refLow,
      refHigh: m.refHigh,
      refText: m.refText,
      flag: flagFromRef(m),
      takenAt,
    };
  });
  if (rows.length) await healthDb.marker().createMany({ data: rows }).catch(() => {});

  // 5. Напоминания — только если о повторе написано в самом документе.
  const base = takenAt || new Date();
  const reminders = parsed.followUps
    .map((f) => {
      let due: Date | null = null;
      if (f.dueDate) due = new Date(f.dueDate + "T00:00:00Z");
      else if (f.afterMonths) {
        due = new Date(base);
        due.setMonth(due.getMonth() + Math.round(f.afterMonths));
      }
      return due ? { userId: user.id, title: f.title, dueAt: due, source: "документ", note: parsed.title } : null;
    })
    .filter(Boolean) as { userId: string; title: string; dueAt: Date; source: string; note: string }[];
  if (reminders.length) await healthDb.reminder().createMany({ data: reminders }).catch(() => {});

  return Response.json({
    ok: true,
    doc: { id: doc.id, title: parsed.title, docDate: parsed.docDate, lab: parsed.lab, summary: parsed.summary },
    markersCount: rows.length,
    remindersCount: reminders.length,
  });
}
