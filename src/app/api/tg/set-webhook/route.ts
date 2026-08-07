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

  // ?base=https://native-domain можно указать, чтобы поставить вебхук на нативный домен Timeweb
  // (обход проблем DNS/сертификата кириллического домена). По умолчанию — PUBLIC_BASE_URL.
  const baseOverride = req.nextUrl.searchParams.get("base");
  const base = baseOverride || process.env.PUBLIC_BASE_URL || req.nextUrl.origin;
  const url = `${base.replace(/\/$/, "")}/api/tg/webhook`;
  const safeSecret = safeWebhookSecret();

  // Исходящая связь к Telegram у Timeweb иногда флапает — ретраим.
  async function tg(method: string, body?: Record<string, unknown>): Promise<unknown> {
    let lastErr = "no attempt";
    for (let i = 0; i < 4; i++) {
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
        lastErr = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
        await new Promise((r) => setTimeout(r, 700 * (i + 1)));
      }
    }
    return { ok: false, error: `${lastErr} (после 4 попыток)` };
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
