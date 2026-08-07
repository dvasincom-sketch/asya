import { NextRequest } from "next/server";
import { safeWebhookSecret } from "@/lib/tgbot";

export const runtime = "nodejs";

// Установка/диагностика вебхука. Открой в браузере:
//   https://<домен>/api/tg/set-webhook?key=<TELEGRAM_WEBHOOK_SECRET>
// Ответ покажет результат setWebhook И текущее состояние (getWebhookInfo).
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
  const safeSecret = safeWebhookSecret();

  async function tg(method: string, body?: Record<string, unknown>): Promise<unknown> {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15000);
      const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {}),
        signal: ctrl.signal,
      });
      clearTimeout(t);
      return await res.json().catch(() => ({ ok: false, error: `не-JSON ответ, HTTP ${res.status}` }));
    } catch (e) {
      return { ok: false, error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) };
    }
  }

  const payload: Record<string, unknown> = {
    url,
    allowed_updates: ["message", "edited_message", "callback_query", "chat_member", "my_chat_member"],
    drop_pending_updates: true,
  };
  if (safeSecret) payload.secret_token = safeSecret;

  const setResult = await tg("setWebhook", payload);
  const info = await tg("getWebhookInfo");

  const appUrl = `${base.replace(/\/$/, "")}/chat`;
  const menu = await tg("setChatMenuButton", { menu_button: { type: "web_app", text: "Открыть Асю", web_app: { url: appUrl } } });

  return Response.json({
    requested_url: url,
    secret_set: Boolean(safeSecret),
    setWebhook: setResult,
    webhookInfo: info,
    menu_button: menu,
    mini_app_url: appUrl,
  });
}
