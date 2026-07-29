import { NextRequest } from "next/server";
import { safeWebhookSecret } from "@/lib/tgbot";

export const runtime = "nodejs";

// Разовая установка вебхука. Открой в браузере:
//   https://<домен>/api/tg/set-webhook?key=<TELEGRAM_WEBHOOK_SECRET>
// Требует заданных TELEGRAM_BOT_TOKEN и TELEGRAM_WEBHOOK_SECRET.
export async function GET(req: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const key = req.nextUrl.searchParams.get("key");

  if (!token || !secret) {
    return Response.json({ ok: false, error: "TELEGRAM_BOT_TOKEN и TELEGRAM_WEBHOOK_SECRET должны быть заданы." }, { status: 503 });
  }
  if (key !== secret) {
    return Response.json({ ok: false, error: "Неверный ключ." }, { status: 401 });
  }

  const base = process.env.PUBLIC_BASE_URL || req.nextUrl.origin;
  const url = `${base.replace(/\/$/, "")}/api/tg/webhook`;

  // Telegram принимает secret_token только из [A-Za-z0-9_-]; отправляем очищенную версию.
  const safeSecret = safeWebhookSecret();
  const payload: Record<string, unknown> = {
    url,
    allowed_updates: ["message"],
    drop_pending_updates: true,
  };
  if (safeSecret) payload.secret_token = safeSecret;

  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => null);

  const data = res ? await res.json().catch(() => ({})) : { ok: false, error: "нет ответа от Telegram" };
  return Response.json({ requested_url: url, telegram: data });
}
