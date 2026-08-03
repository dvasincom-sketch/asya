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

// Контекст-грунтовка для навыка: кандидаты из каталога + инструкция отобрать 5–7.
export async function buildTgGuideContext(query: string): Promise<string> {
  if (!hasTgCatalog()) {
    return (
      "\n\n[Каталог каналов пока не подключён] Честно и тепло скажи человеку, что поиск каналов сейчас недоступен " +
      "и вы вернётесь к нему позже. Ничего не выдумывай и не предлагай конкретные каналы."
    );
  }
  const chs = await searchChannels(query);
  if (!chs.length) {
    return (
      "\n\n[Поиск по каталогу ничего не дал] Мягко скажи, что по этому запросу ничего не нашлось, " +
      "и предложи переформулировать или уточнить тему. Не выдумывай каналы."
    );
  }
  const list = chs
    .slice(0, 20)
    .map((c, i) => {
      const parts = [
        `${i + 1}. ${c.title}`,
        c.username ? `(@${c.username})` : "",
        c.participants ? `— ${c.participants.toLocaleString("ru-RU")} подписчиков` : "",
        c.about ? `: ${c.about}` : "",
      ].filter(Boolean);
      return parts.join(" ");
    })
    .join("\n");
  return (
    `\n\nКандидаты из каталога Telegram по запросу «${query}» (это данные каталога — не добавляй ничего сверх списка):\n${list}\n\n` +
    "Отбери 5–7 самых подходящих под запрос человека, отсей нерелевантное и представь их тепло и по делу, живым текстом: " +
    "для каждого — название, ссылка t.me/username (если есть @username) и одна короткая фраза, чем он подойдёт. " +
    "Никогда не предлагай каналы, которых нет в списке. Если подходящих меньше пяти — покажи столько, сколько реально подходит."
  );
}
