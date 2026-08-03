import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Разрешённые события воронки. Белый список — чтобы в базу не попадало ничего лишнего.
const ALLOWED = new Set([
  "landing_view",
  "chat_open",
  "first_message",
  "message_sent",
  "login_view",
  "login_done",
  "consent_given",
  "session_start",
  "session_saved",
  "miniapp_open",
  "gate_shown",
  "paywall_view",
  "booking_card_shown",
  "booking_service_picked",
  "booking_created",
  "bookings_checked",
  "health_open",
  "health_consent",
  "health_doc_added",
]);

type EventDb = {
  create: (a: {
    data: { name: string; anonId?: string | null; userId?: string | null; meta?: string | null };
  }) => Promise<unknown>;
};
function eventDb(): EventDb {
  return (prisma as unknown as { event: EventDb }).event;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "");
  // 204 не может нести тело — иначе undici бросает TypeError. Отвечаем пустым 204.
  if (!ALLOWED.has(name)) return new Response(null, { status: 204 });

  const user = await getCurrentUser().catch(() => null);
  const anonId = String(body.anonId || "").slice(0, 40) || null;
  // meta — только короткая техническая метка (например, id шаблона сессии), без текста разговоров.
  const meta = body.meta ? String(body.meta).slice(0, 80) : null;

  await eventDb().create({ data: { name, anonId, userId: user?.id ?? null, meta } }).catch(() => {});
  return Response.json({ ok: true });
}
