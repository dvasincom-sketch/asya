import { getCurrentUser } from "@/lib/auth";
import { healthDb, type HealthUser, type MarkerRow } from "@/lib/healthDb";
import { markerLabel } from "@/lib/healthMarkers";
import { complete, hasKey } from "@/lib/timeweb";

export const runtime = "nodejs";

type Attention = { code: string; name: string; value: number | null; valueText: string | null; unit: string | null; refText: string | null; flag: string | null; takenAt: Date | null };
type Change = {
  code: string; name: string; unit: string | null;
  prev: number; prevAt: Date | null;
  last: number; lastAt: Date | null;
  deltaPct: number; direction: "up" | "down";
  wasFlag: string | null; nowFlag: string | null;
};

export async function GET() {
  const user = (await getCurrentUser().catch(() => null)) as (HealthUser & { id: string }) | null;
  if (!user) return Response.json({ user: null });
  if (!user.healthEnabled) return Response.json({ user: { id: user.id }, needsConsent: true });

  const [docs, markers, reminders] = await Promise.all([
    healthDb.doc()
      .findMany({ where: { userId: user.id }, orderBy: [{ docDate: "desc" }, { createdAt: "desc" }], take: 100 })
      .catch(() => []),
    healthDb.marker()
      .findMany({ where: { userId: user.id }, orderBy: [{ takenAt: "desc" }, { createdAt: "desc" }], take: 2000 })
      .catch(() => [] as MarkerRow[]),
    healthDb.reminder()
      .findMany({ where: { userId: user.id, doneAt: null }, orderBy: { dueAt: "asc" }, take: 20 })
      .catch(() => []),
  ]);

  // Группируем по показателю: свежее — первым (сортировка уже по убыванию даты).
  const byCode = new Map<string, MarkerRow[]>();
  for (const m of markers) {
    if (!byCode.has(m.code)) byCode.set(m.code, []);
    byCode.get(m.code)!.push(m);
  }

  // 1. Что сейчас важно — отклонения по последнему результату, и только по референсу документа.
  const attention: Attention[] = [];
  for (const [code, list] of byCode) {
    const last = list[0];
    if (!last || (last.flag !== "low" && last.flag !== "high")) continue;
    attention.push({
      code,
      name: markerLabel(code, last.name),
      value: last.value,
      valueText: last.valueText,
      unit: last.unit,
      refText: last.refText,
      flag: last.flag,
      takenAt: last.takenAt,
    });
  }

  // 2. Что изменилось — сравниваем два последних измерения одного показателя.
  const changes: Change[] = [];
  for (const [code, list] of byCode) {
    const nums = list.filter((m) => typeof m.value === "number");
    if (nums.length < 2) continue;
    const last = nums[0];
    const prev = nums[1];
    if (last.value === null || prev.value === null || prev.value === 0) continue;
    const deltaPct = ((last.value - prev.value) / Math.abs(prev.value)) * 100;
    // Показываем только заметные изменения либо смену статуса относительно референса.
    const statusChanged = (prev.flag || null) !== (last.flag || null);
    if (Math.abs(deltaPct) < 10 && !statusChanged) continue;
    changes.push({
      code,
      name: markerLabel(code, last.name),
      unit: last.unit,
      prev: prev.value,
      prevAt: prev.takenAt,
      last: last.value,
      lastAt: last.takenAt,
      deltaPct: Math.round(deltaPct * 10) / 10,
      direction: last.value > prev.value ? "up" : "down",
      wasFlag: prev.flag,
      nowFlag: last.flag,
    });
  }
  changes.sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct));

  // 3. Что дальше — напоминания из документов (своих Ася не выдумывает).
  const next = reminders.map((r) => ({ id: r.id, title: r.title, dueAt: r.dueAt, source: r.source, note: r.note }));

  // Короткое объяснение простым языком — строго по цифрам, что мы передали.
  let plain = "";
  if (hasKey() && (attention.length || changes.length)) {
    const facts = [
      attention.length
        ? "Вне референса лаборатории: " +
          attention
            .map((a) => `${a.name} ${a.value ?? a.valueText ?? ""}${a.unit ? " " + a.unit : ""} (норма ${a.refText || "—"}, ${a.flag === "low" ? "ниже" : "выше"})`)
            .join("; ")
        : "",
      changes.length
        ? "Изменения: " +
          changes
            .slice(0, 6)
            .map((c) => `${c.name} с ${c.prev} на ${c.last}${c.unit ? " " + c.unit : ""} (${c.deltaPct > 0 ? "+" : ""}${c.deltaPct}%)`)
            .join("; ")
        : "",
    ]
      .filter(Boolean)
      .join(". ");

    const sys =
      "Ты — Ася, тёплая внимательная подружка. Объясни человеку простым языком, что показывают эти цифры из его анализов: " +
      "2–4 коротких предложения, на «ты», без медицинских терминов там, где можно проще. " +
      "СТРОГИЕ ЗАПРЕТЫ: не ставь диагнозов, не называй причины отклонений, не советуй лекарства, добавки, дозировки и диеты, " +
      "не пугай. Опирайся только на переданные цифры и не добавляй никаких других фактов. " +
      "Заверши мыслью, что показатели вне нормы стоит обсудить с врачом — это его работа, а твоя — чтобы человек понимал, что происходит. " +
      "Пиши обычным текстом, без разметки: никаких звёздочек для выделения, решёток, дефисов-списков и таблиц.";
    plain = (await complete([{ role: "user", content: facts }], sys, 380)).trim();
  }

  return Response.json({
    user: { id: user.id },
    hasData: docs.length > 0,
    docsCount: docs.length,
    attention: attention.slice(0, 8),
    changes: changes.slice(0, 8),
    next,
    plain,
    docs: docs.slice(0, 30).map((d) => ({
      id: d.id,
      title: d.title,
      kind: d.kind,
      docDate: d.docDate,
      lab: d.lab,
      summary: d.summary,
      createdAt: d.createdAt,
    })),
    markersTotal: markers.length,
    trackedCodes: [...byCode.entries()]
      .map(([code, list]) => ({ code, name: markerLabel(code, list[0].name), points: list.filter((m) => typeof m.value === "number").length }))
      .filter((x) => x.points >= 1)
      .sort((a, b) => b.points - a.points)
      .slice(0, 40),
  });
}
