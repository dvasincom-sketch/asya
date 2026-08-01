import { NextRequest } from "next/server";
import { yooGetPayment, activateSub } from "@/lib/plus";

export const runtime = "nodejs";

// Вебхук YooKassa. Тело не подписано — не доверяем ему, а перезапрашиваем платёж у API.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { event?: string; object?: { id?: string } } | null;
  const id = body?.object?.id;
  if (!id) return Response.json({ ok: true });

  const p = await yooGetPayment(id);
  if (p && (p.status === "succeeded" || p.paid)) {
    const userId = p.metadata?.userId;
    if (userId) await activateSub(userId, p.payment_method?.id ?? null);
  }
  return Response.json({ ok: true });
}
