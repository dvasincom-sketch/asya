import { NextRequest } from "next/server";
import { handleYclientsEvents } from "@/lib/triggers";

export const runtime = "nodejs";

function authed(req: NextRequest): boolean {
  const secret = process.env.YCLIENTS_WEBHOOK_SECRET;
  if (!secret) return true; // если секрет не задан — не блокируем (упрощает первичную настройку)
  const got = req.nextUrl.searchParams.get("secret") || req.headers.get("x-yclients-secret") || "";
  return got === secret;
}

export async function POST(req: NextRequest) {
  console.log("[triggers] yclients POST получен, authed=" + authed(req));
  if (!authed(req)) return Response.json({ ok: false }, { status: 401 });
  const payload = await req.json().catch(() => null);
  // Логируем сырое событие — чтобы сверить фактический формат Yclients и при необходимости поправить парсер.
  console.log("[triggers] yclients payload:", JSON.stringify(payload)?.slice(0, 2000));
  if (payload == null) return Response.json({ ok: true });
  try {
    const res = await handleYclientsEvents(payload);
    return Response.json({ ok: true, ...res });
  } catch (e) {
    console.error("[triggers] ошибка:", e instanceof Error ? e.message : String(e));
    return Response.json({ ok: true });
  }
}

export async function GET() {
  return Response.json({ ok: true, hook: "yclients" });
}
