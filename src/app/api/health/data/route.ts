import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { healthDb, type HealthUser } from "@/lib/healthDb";

export const runtime = "nodejs";

// Удаление: один документ ({ docId }) или все медданные ({ all: true }).
// Медданные удаляются отдельно от остального — это осознанное действие.
export async function DELETE(req: NextRequest) {
  const user = (await getCurrentUser().catch(() => null)) as (HealthUser & { id: string }) | null;
  if (!user) return Response.json({ error: "auth" }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  if (body.all === true) {
    // userId в условии — чтобы нельзя было задеть чужие данные.
    await healthDb.marker().deleteMany({ where: { userId: user.id } }).catch(() => {});
    await healthDb.reminder().deleteMany({ where: { userId: user.id } }).catch(() => {});
    await healthDb.doc().deleteMany({ where: { userId: user.id } }).catch(() => {});
    return Response.json({ ok: true, wiped: true });
  }

  if (body.docId) {
    const id = String(body.docId);
    await healthDb.marker().deleteMany({ where: { userId: user.id, docId: id } }).catch(() => {});
    await healthDb.doc().deleteMany({ where: { id, userId: user.id } }).catch(() => {});
    return Response.json({ ok: true });
  }

  return Response.json({ error: "bad_request" }, { status: 400 });
}

// Напоминания: отметить выполненным ({ id, done: true }) или добавить своё ({ title, dueAt }).
export async function POST(req: NextRequest) {
  const user = (await getCurrentUser().catch(() => null)) as (HealthUser & { id: string }) | null;
  if (!user) return Response.json({ error: "auth" }, { status: 401 });
  if (!user.healthEnabled) return Response.json({ error: "no_consent" }, { status: 403 });

  const body = await req.json().catch(() => ({}));

  if (body.id && body.done === true) {
    await healthDb.reminder()
      .updateMany({ where: { id: String(body.id), userId: user.id }, data: { doneAt: new Date() } })
      .catch(() => {});
    return Response.json({ ok: true });
  }

  const title = String(body.title || "").trim().slice(0, 160);
  const due = String(body.dueAt || "");
  if (title && /^\d{4}-\d{2}-\d{2}$/.test(due)) {
    await healthDb.reminder()
      .create({ data: { userId: user.id, title, dueAt: new Date(due + "T00:00:00Z"), source: "вручную" } })
      .catch(() => {});
    return Response.json({ ok: true });
  }

  return Response.json({ error: "bad_request" }, { status: 400 });
}
