// Поиск Telegram-каналов/чатов по каталогу TGStat. Гейт — переменная TGSTAT_TOKEN.
// Без токена навык деградирует мягко (Ася честно говорит, что каталог не подключён).
// Ася НЕ выдумывает каналы — работает только по тому, что вернул каталог.

export type CatalogChannel = {
  title: string;
  username: string | null;
  link: string | null;
  participants: number | null;
  about: string | null;
  category: string | null;
};

export function hasTgCatalog(): boolean {
  return Boolean(process.env.TGSTAT_TOKEN);
}

function usernameFromLink(link: string | null | undefined): string | null {
  if (!link) return null;
  const m = String(link).match(/t\.me\/(?:s\/)?([A-Za-z0-9_]{3,})/i);
  return m ? m[1] : null;
}

// Поиск каналов по запросу. Никогда не бросает — при любой ошибке возвращает [].
export async function searchChannels(query: string): Promise<CatalogChannel[]> {
  const token = process.env.TGSTAT_TOKEN;
  if (!token) return [];
  const q = query.trim().slice(0, 200);
  if (q.length < 2) return [];

  const url =
    "https://api.tgstat.ru/channels/search" +
    `?token=${encodeURIComponent(token)}` +
    `&q=${encodeURIComponent(q)}` +
    "&limit=40&extended=1";

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 7000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      status?: string;
      response?: { items?: unknown[]; channels?: unknown[] };
    };
    if (data.status && data.status !== "ok") return [];
    const items = (data.response?.items || data.response?.channels || []) as Record<string, unknown>[];
    const out: CatalogChannel[] = [];
    for (const raw of items) {
      const ch = (raw.channel ?? raw) as Record<string, unknown>;
      const link = (ch.link as string) ?? null;
      const username = ((ch.username as string) || usernameFromLink(link) || "").replace(/^@/, "") || null;
      const title = String(ch.title ?? "").trim();
      if (!title) continue;
      const participants =
        typeof ch.participants_count === "number"
          ? (ch.participants_count as number)
          : typeof ch.participants === "number"
            ? (ch.participants as number)
            : null;
      out.push({
        title: title.slice(0, 120),
        username,
        link: link || (username ? `https://t.me/${username}` : null),
        participants,
        about: ch.about ? String(ch.about).slice(0, 220) : null,
        category: ch.category ? String(ch.category) : null,
      });
    }
    return out;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

// Структурный отбор каналов: Ася выбирает 5–7 из кандидатов и пишет короткую вводную.
// Возвращает { intro, channels } — карточки рисуются кликабельными в чате.
import { complete } from "./timeweb";
import { clean } from "./text";

export async function selectChannels(
  query: string,
  candidates: CatalogChannel[],
): Promise<{ intro: string; channels: CatalogChannel[] }> {
  if (!hasTgCatalog()) {
    return { intro: "Пока не могу искать каналы — каталог не подключён. Давай вернёмся к этому чуть позже 🤍", channels: [] };
  }
  if (!candidates.length) {
    return {
      intro: "По этому запросу ничего не нашлось. Скажи чуть иначе или добавь деталей — тему, для чего это тебе, какого размера сообщество 🤍",
      channels: [],
    };
  }
  const list = candidates
    .slice(0, 20)
    .map((c, i) => `${i}. ${c.title}${c.username ? ` (@${c.username})` : ""}${c.about ? ` — ${c.about}` : ""}`)
    .join("\n");
  const sys =
    "Ты — Ася, тёплая подружка-навигатор по Telegram. Из списка кандидатов выбери 5–7 самых подходящих под запрос человека, " +
    "отсей нерелевантное и опасное (мошеннические, «сигналы», лёгкий заработок, 18+, азартные). " +
    "Верни СТРОГО JSON без пояснений: {\"intro\":\"1–2 тёплые фразы вводной, без перечисления каналов\",\"pick\":[индексы выбранных из списка]}. " +
    "Если подходящих мало — верни столько, сколько реально подходит; если совсем нет — pick пустой, а intro честно об этом.";
  const usr = `Запрос человека: «${query}».\nКандидаты:\n${list}`;
  const raw = await complete([{ role: "user", content: usr }], sys, 400).catch(() => "");
  const m = raw.match(/\{[\s\S]*\}/);
  let intro = "";
  let pick: number[] = [];
  let parsed = false;
  if (m) {
    try {
      const o = JSON.parse(m[0]) as { intro?: unknown; pick?: unknown };
      parsed = true;
      intro = clean(String(o.intro ?? "")).trim();
      pick = Array.isArray(o.pick) ? o.pick.map(Number).filter((n) => Number.isInteger(n) && n >= 0) : [];
    } catch {
      parsed = false;
    }
  }
  const chosen = pick.map((i) => candidates[i]).filter(Boolean).slice(0, 7);
  const channels = parsed ? chosen : candidates.slice(0, 6);
  if (!intro) intro = channels.length ? "Вот что подобралось под твой запрос 🤍" : "По этому запросу пока ничего подходящего — уточни детали?";
  return { intro, channels };
}
