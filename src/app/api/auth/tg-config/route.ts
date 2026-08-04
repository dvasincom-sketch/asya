export const runtime = "nodejs";

// Юзернейм бота для Telegram Login Widget — берём в РАНТАЙМЕ из токена (getMe), а не из
// NEXT_PUBLIC (которую Next впекает только на сборке; на Timeweb env приходит в рантайме).
// Кешируем удачный результат в памяти процесса.
let cached: string | null = null;

export async function GET() {
  if (cached) return Response.json({ botUsername: cached });
  const token = process.env.TELEGRAM_BOT_TOKEN;
  // Фолбэк на build-time переменную, если она всё же задана.
  const envName = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || process.env.TELEGRAM_BOT_USERNAME;
  if (envName) {
    cached = String(envName).replace(/^@/, "");
    return Response.json({ botUsername: cached });
  }
  if (!token) return Response.json({ botUsername: null });
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(`https://api.telegram.org/bot${token}/getMe`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) {
      console.warn(`[tg-config] getMe HTTP ${r.status} — юзернейм не получен (задай TELEGRAM_BOT_USERNAME)`);
      return Response.json({ botUsername: null });
    }
    const d = (await r.json()) as { ok?: boolean; result?: { username?: string } };
    const username = d?.result?.username || null;
    if (!username) console.warn("[tg-config] getMe без username (задай TELEGRAM_BOT_USERNAME)");
    if (username) cached = username; // кешируем только успех
    return Response.json({ botUsername: username });
  } catch (e) {
    console.warn(`[tg-config] getMe недоступен: ${e instanceof Error ? e.message : String(e)} (задай TELEGRAM_BOT_USERNAME)`);
    return Response.json({ botUsername: null }); // не кешируем неудачу — повторим позже
  }
}
