import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getForm } from "@/lib/profileForms";

export const runtime = "nodejs";

// Prisma-клиент в песочнице собран без новой модели — идём через приведение типов.
type PARow = { formId: string; questionId: string; value: string };
function paDb() {
  return (
    prisma as unknown as {
      profileAnswer: {
        findMany: (a: { where: { userId: string } }) => Promise<PARow[]>;
        upsert: (a: {
          where: { userId_formId_questionId: { userId: string; formId: string; questionId: string } };
          create: { userId: string; formId: string; questionId: string; value: string };
          update: { value: string };
        }) => Promise<unknown>;
        deleteMany: (a: { where: { userId: string; formId: string; questionId: { in: string[] } } }) => Promise<unknown>;
      };
    }
  ).profileAnswer;
}

// Что человек уже заполнил о себе: { formId: { questionId: value } }.
export async function GET() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return Response.json({ answers: {} });
  const rows = await paDb().findMany({ where: { userId: user.id } }).catch(() => [] as PARow[]);
  const answers: Record<string, Record<string, string>> = {};
  for (const r of rows) {
    (answers[r.formId] ||= {})[r.questionId] = r.value;
  }
  return Response.json({ answers });
}

// Сохранить ответы одной грани (пустые — удаляем, чтобы можно было стереть).
export async function POST(req: NextRequest) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return Response.json({ error: "auth" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const form = getForm(String(b.formId || ""));
  if (!form) return Response.json({ error: "bad_form" }, { status: 400 });

  const incoming = b.answers && typeof b.answers === "object" ? (b.answers as Record<string, unknown>) : {};
  const empties: string[] = [];
  for (const q of form.questions) {
    const raw = incoming[q.id];
    const val = typeof raw === "string" ? raw.trim().slice(0, 1000) : "";
    if (val) {
      await paDb()
        .upsert({
          where: { userId_formId_questionId: { userId: user.id, formId: form.id, questionId: q.id } },
          create: { userId: user.id, formId: form.id, questionId: q.id, value: val },
          update: { value: val },
        })
        .catch(() => {});
    } else {
      empties.push(q.id);
    }
  }
  if (empties.length) {
    await paDb()
      .deleteMany({ where: { userId: user.id, formId: form.id, questionId: { in: empties } } })
      .catch(() => {});
  }
  return Response.json({ ok: true });
}
