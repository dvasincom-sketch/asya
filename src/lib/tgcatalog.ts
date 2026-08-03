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

  const country = process.env.TGSTAT_COUNTRY || "ru";
  // Отпечаток токена (не сам секрет) — чтобы в логах сверить, что в проде стоит рабочий токен.
  const tokenFp = `${token.slice(0, 3)}…${token.slice(-3)}(${token.length})`;
  const params = new URLSearchParams({
    token,
    q: query,
    country, // обязательный параметр контракта; валидный код из database/countries
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
      console.warn(`[tgstat] HTTP ${res.status} token=${tokenFp} country=${country} q="${query}" — каталог недоступен`);
      return { items: [], available: false };
    }
    const data = (await res.json()) as {
      status?: string;
      error?: string;
      response?: { items?: unknown[]; channels?: unknown[]; count?: number };
    };
    if (data.status && data.status !== "ok") {
      // Ошибка уровня аккаунта/запроса (token_invalid, no_active_subscription, квота, кривой параметр).
      console.warn(`[tgstat] status=${data.status} error=${data.error ?? "—"} token=${tokenFp} country=${country} q="${query}" — каталог недоступен`);
      return { items: [], available: false };
    }
    const rawItems = (data.response?.items || data.response?.channels || []) as Record<string, unknown>[];
    // Полная диагностика: токен(отпечаток)/страна/тип/категория/запрос -> сколько отдал API.
    console.warn(
      `[tgstat] ok token=${tokenFp} country=${country} peer=${peerType} cat=${category || "-"} q="${query}" apiCount=${data.response?.count ?? "?"} items=${rawItems.length}`,
    );
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

export type SearchSpec = { queries: string[]; peerType: PeerType; category: string; isSearch: boolean };

// Строим запрос к каталогу из разговора: TGStat ищет по СЛОВАМ в названии/описании,
// поэтому сырая фраза («почему Ставрополь? я в Москве») даёт мусор. Модель извлекает
// чистые ключевые слова (тема + город) и тип: сообщество (chat) или контентный канал (channel).
// Лестница запросов от точного к общему: сохраняем специфику (город, подтему) как можно
// дольше, а не сразу падаем в одно общее слово. Используется как фолбэк и для сокращения.
function queryLadder(text: string): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (const n of [4, 2, 1]) {
    const v = words.slice(0, n).join(" ").trim();
    if (v.length >= 2 && !out.includes(v)) out.push(v);
  }
  return out.length ? out : [text.trim()].filter((x) => x.length >= 2);
}

export async function extractSearchSpec(messages: ChatMessage[]): Promise<SearchSpec> {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const fbq = String(lastUser?.content || "").trim().slice(0, 60);
  const fallback: SearchSpec = { queries: queryLadder(fbq), peerType: "all", category: "", isSearch: true };
  if (!hasTgCatalog()) return fallback;

  const convo = messages
    .slice(-8)
    .map((m) => `${m.role === "user" ? "Человек" : "Ася"}: ${m.content}`)
    .join("\n");
  const catList = Object.entries(TG_CATEGORIES)
    .map(([c, n]) => `${c} (${n})`)
    .join(", ");
  const sys =
    "Ты формируешь поисковые запросы к каталогу Telegram по разговору. Это режим-навык: цель одна — найти релевантный канал или чат. " +
    "ВАЖНО про механику: TGStat ищет по совпадению ВСЕХ слов запроса в названии/описании, поэтому длинный запрос из 4+ слов обычно НЕ находит ничего. " +
    'Верни СТРОГО JSON без пояснений: {"isSearch":true|false,"queries":["точный","средний","общий"],"peerType":"chat|channel|all","category":"код|пусто"}. ' +
    "isSearch=false ТОЛЬКО если сообщение — не просьба найти канал/чат (приветствие, «что ты умеешь», благодарность, оффтоп); тогда queries=[]. Иначе isSearch=true. " +
    "queries — 2–3 варианта ОТ ТОЧНОГО К ОБЩЕМУ, каждый в именительном падеже, без слов «канал/чат/группа/ищу/хочу», без кавычек и знаков препинания: " +
    "1) точный — ядро темы + город + подтема, но НЕ длиннее 3 слов; " +
    "2) средний — ядро темы плюс город ИЛИ подтема, 2 слова; " +
    "3) общий — только ядро темы, 1 слово. Не повторяй одинаковые варианты. " +
    "НЕ добавляй служебные слова вроде «русскоговорящий», «авторский», «блог», «мужчина» — они не помогают поиску и только зануляют выдачу. " +
    'peerType: "chat" — чат/группа/сообщество; "channel" — канал/новости/блог; "all" — если неясно. ' +
    "category — код из списка, если тема ясно попадает, иначе пустая строка. " +
    `Категории: ${catList}. ` +
    "Учитывай весь разговор: уточнение города или темы в новой реплике соединяй с прежним поиском. " +
    'Примеры: «хочу чат мам в декрете, я в Москве» -> {"isSearch":true,"queries":["мамы декрет москва","мамы москва","мамы"],"peerType":"chat","category":"babies"}; ' +
    '«канал русскоговорящего мужчины про Британию» -> {"isSearch":true,"queries":["британия жизнь","британия","британия"],"peerType":"channel","category":""}; ' +
    '«новости про ИИ» -> {"isSearch":true,"queries":["новости искусственный интеллект","искусственный интеллект","нейросети"],"peerType":"channel","category":"tech"}.';
  const raw = await complete([{ role: "user", content: convo }], sys, 160).catch(() => "");
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return fallback;
  try {
    const o = JSON.parse(m[0]) as { isSearch?: unknown; queries?: unknown; q?: unknown; peerType?: unknown; category?: unknown };
    const isSearch = o.isSearch !== false; // по умолчанию считаем поиском
    const peerType: PeerType = o.peerType === "chat" || o.peerType === "channel" ? o.peerType : "all";
    // Категория валидируется по безопасному таксону; неизвестная/небезопасная -> пусто.
    const category = typeof o.category === "string" && TG_CATEGORIES[o.category] ? o.category : "";
    let queries = Array.isArray(o.queries)
      ? o.queries.map((x) => String(x).trim().slice(0, 80)).filter((x) => x.length >= 2)
      : [];
    if (!queries.length && typeof o.q === "string") queries = queryLadder(o.q); // совместимость со старым форматом
    queries = [...new Set(queries)].slice(0, 3);
    if (!isSearch) return { queries: [], peerType: "all", category: "", isSearch: false };
    if (!queries.length) return fallback;
    return { queries, peerType, category, isSearch: true };
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
