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

// Нормализуем ссылку канала до полного https-URL, иначе карточка в чате не кликается
// (TGStat часто отдаёт link как "t.me/name" без схемы).
function fullLink(link: string | null, username: string | null): string | null {
  if (link) {
    const l = String(link).trim();
    if (/^https?:\/\//i.test(l)) return l;
    if (l) return `https://${l.replace(/^\/+/, "")}`;
  }
  return username ? `https://t.me/${username}` : null;
}

// Результат поиска: помимо каналов отдаём признак «каталог доступен».
// available=false — проблема НЕ в запросе человека (нет токена, невалиден,
// неактивна подписка, сеть) → навык честно скажет «каталог недоступен», а не «ничего
// не нашлось». available=true с пустым items — это реально пустой результат.
export type SearchResult = { items: CatalogChannel[]; available: boolean };

// Поиск каналов/чатов по запросу. Никогда не бросает.
// Контракт TGStat channels/search: обязателен token, country и (q или category).
export type PeerType = "channel" | "chat" | "all";

// Категории каталога TGStat (database/categories) — фиксированный таксон для жёсткого
// таргетинга темы в навыке. Небезопасные (adult, erotica, gambling, darknet, shock)
// исключены намеренно: навык их не ищет. Ключ — код TGStat, значение — имя для подсказки модели.
export const TG_CATEGORIES: Record<string, string> = {
  tech: "Технологии", news: "Новости и СМИ", food: "Еда и кулинария", blogs: "Блоги",
  education: "Образование", entertainment: "Юмор и развлечения", pics: "Картинки и фото",
  apps: "Софт и приложения", economics: "Экономика", video: "Видео и фильмы",
  business: "Бизнес и стартапы", music: "Музыка", sales: "Продажи", books: "Книги",
  quotes: "Цитаты", sport: "Спорт", language: "Лингвистика", crypto: "Криптовалюты",
  career: "Карьера", travels: "Путешествия", handmade: "Рукоделие", beauty: "Мода и красота",
  medicine: "Медицина", transport: "Транспорт", marketing: "Маркетинг, PR, реклама",
  telegram: "Telegram", psychology: "Психология", design: "Дизайн", babies: "Семья и дети",
  nature: "Природа", politics: "Политика", religion: "Религия", edutainment: "Познавательное",
  games: "Игры", health: "Здоровье и фитнес", instagram: "Инстаграм", courses: "Курсы и гайды",
  art: "Искусство", law: "Право", construction: "Интерьер и строительство", esoterics: "Эзотерика",
};

export async function searchChannels(q: string, peerType: PeerType = "all", category = ""): Promise<SearchResult> {
  const token = process.env.TGSTAT_TOKEN;
  if (!token) return { items: [], available: false };
  const query = q.trim().slice(0, 200);
  if (query.length < 3) return { items: [], available: true }; // слишком коротко — это «пусто», не сбой

  const params = new URLSearchParams({
    token,
    q: query,
    country: process.env.TGSTAT_COUNTRY || "ru", // обязательный параметр контракта
    peer_type: peerType, // chat — сообщества/группы, channel — контентные каналы, all — оба
    search_by_description: "1", // шире охват: искать и по описаниям
    limit: "40",
  });
  // Категория (если распознана и безопасна) — жёстко сужает поиск в нужную тему.
  if (category && TG_CATEGORIES[category]) params.set("category", category);
  const url = `https://api.tgstat.ru/channels/search?${params.toString()}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 7000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) {
      console.warn(`[tgstat] channels/search HTTP ${res.status} — каталог недоступен`);
      return { items: [], available: false };
    }
    const data = (await res.json()) as {
      status?: string;
      error?: string;
      response?: { items?: unknown[]; channels?: unknown[] };
    };
    if (data.status && data.status !== "ok") {
      // Ошибка уровня аккаунта/запроса (token_invalid, no_active_subscription, квота, кривой параметр).
      // Это НЕ «человек ничего не нашёл» — помечаем каталог недоступным. Причина видна в логах Timeweb.
      console.warn(`[tgstat] channels/search status=${data.status} error=${data.error ?? "—"} — каталог недоступен`);
      return { items: [], available: false };
    }
    const rawItems = (data.response?.items || data.response?.channels || []) as Record<string, unknown>[];
    if (!rawItems.length) console.warn(`[tgstat] channels/search: 0 результатов по запросу «${query}» (${peerType})`);
    const out: CatalogChannel[] = [];
    for (const raw of rawItems) {
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
        link: fullLink(link, username),
        participants,
        about: ch.about ? String(ch.about).slice(0, 220) : null,
        category: ch.category ? String(ch.category) : null,
      });
    }
    return { items: out, available: true };
  } catch (e) {
    console.warn(`[tgstat] channels/search исключение: ${e instanceof Error ? e.message : String(e)}`);
    return { items: [], available: false };
  } finally {
    clearTimeout(timer);
  }
}

// Структурный отбор каналов: Ася выбирает 5–7 из кандидатов и пишет короткую вводную.
// Возвращает { intro, channels } — карточки рисуются кликабельными в чате.
import { complete } from "./timeweb";
import { clean } from "./text";
import type { ChatMessage } from "./crisis";

export type SearchSpec = { q: string; peerType: PeerType; category: string };

// Строим запрос к каталогу из разговора: TGStat ищет по СЛОВАМ в названии/описании,
// поэтому сырая фраза («почему Ставрополь? я в Москве») даёт мусор. Модель извлекает
// чистые ключевые слова (тема + город) и тип: сообщество (chat) или контентный канал (channel).
export async function extractSearchSpec(messages: ChatMessage[]): Promise<SearchSpec> {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const fallback: SearchSpec = { q: String(lastUser?.content || "").trim().slice(0, 60), peerType: "all", category: "" };
  if (!hasTgCatalog()) return fallback;

  const convo = messages
    .slice(-8)
    .map((m) => `${m.role === "user" ? "Человек" : "Ася"}: ${m.content}`)
    .join("\n");
  const catList = Object.entries(TG_CATEGORIES)
    .map(([c, n]) => `${c} (${n})`)
    .join(", ");
  const sys =
    "Ты формируешь точный поисковый запрос к каталогу Telegram по разговору. Это режим-навык: цель одна — " +
    "найти релевантный канал или чат, без свободной беседы. " +
    'Верни СТРОГО JSON без пояснений: {"q":"...","peerType":"chat|channel|all","category":"код|пусто"}. ' +
    "q — 2–4 ключевых слова: тема и город/локация, если человек их назвал, в именительном падеже, " +
    "без слов «канал», «чат», «группа», «ищу», «хочу», без кавычек и знаков препинания. " +
    'peerType: "chat" — если человек ищет чат, группу, сообщество для общения; ' +
    '"channel" — если ищет канал с контентом, новостями, блог; "all" — если неясно. ' +
    "category — код из списка ниже, если тема ясно в него попадает, иначе пустая строка. " +
    `Категории: ${catList}. ` +
    "Учитывай весь разговор: если в новой реплике человек уточняет город или тему — соедини с тем, что искали раньше. " +
    'Примеры: «хочу чат мам в декрете, я в Москве» -> {"q":"мамы декрет москва","peerType":"chat","category":"babies"}; ' +
    '«новости про ИИ» -> {"q":"новости искусственный интеллект","peerType":"channel","category":"tech"}; ' +
    '«канал про бег» -> {"q":"бег","peerType":"channel","category":"sport"}.';
  const raw = await complete([{ role: "user", content: convo }], sys, 120).catch(() => "");
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return fallback;
  try {
    const o = JSON.parse(m[0]) as { q?: unknown; peerType?: unknown; category?: unknown };
    const q = String(o.q ?? "").trim().slice(0, 80);
    const peerType: PeerType = o.peerType === "chat" || o.peerType === "channel" ? o.peerType : "all";
    // Категория валидируется по безопасному таксону; неизвестная/небезопасная -> пусто.
    const category = typeof o.category === "string" && TG_CATEGORIES[o.category] ? o.category : "";
    if (q.length < 2) return fallback;
    return { q, peerType, category };
  } catch {
    return fallback;
  }
}

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
