export const runtime = "nodejs";

// Юзернейм бота для Telegram Login Widget. Порядок источников:
// 1) env (TELEGRAM_BOT_USERNAME / NEXT_PUBLIC_...), 2) getMe по токену (если прод дотянется),
// 3) зашитый дефолт — чтобы кнопка рисовалась ВСЕГДА, без зависимости от env и от api.telegram.org.
const DEFAULT_BOT_USERNAME = "asyaonlinebot";

let cached: string | null = null;

export async function GET() {
  if (cached) return Response.json({ botUsername: cached });

  const env = (process.env.TELEGRAM_BOT_USERNAME || process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "")
    .replace(/^@/, "")
    .trim();
  if (env) {
    cached = env;
    return Response.json({ botUsername: env });
  }

  // Пробуем уточнить через getMe (вдруг юзернейм сменится), но результат не обязателен.
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (token) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      const r = await fetch(`https://api.telegram.org/bot${token}/getMe`, { signal: ctrl.signal });
      clearTimeout(t);
      if (r.ok) {
        const d = (await r.json()) as { result?: { username?: string } };
        const u = d?.result?.username;
        if (u) {
          cached = u;
          return Response.json({ botUsername: u });
        }
      } else {
        console.warn(`[tg-config] getMe HTTP ${r.status} — использую дефолт ${DEFAULT_BOT_USERNAME}`);
      }
    } catch (e) {
      console.warn(`[tg-config] getMe недоступен (${e instanceof Error ? e.message : String(e)}) — дефолт ${DEFAULT_BOT_USERNAME}`);
    }
  }

  return Response.json({ botUsername: DEFAULT_BOT_USERNAME });
}
