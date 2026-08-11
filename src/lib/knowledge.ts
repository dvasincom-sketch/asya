// База знаний агента поддержки: доступ к статьям + ответ по базе (простой retrieval — вся база раздела в контекст).
import { complete } from "./timeweb";
import { fetchRepoContext } from "./repoSource";
import { prisma } from "./prisma";

export type Article = { id: string; space: string; title: string; body: string; source: string | null; updatedAt?: string };

type KbDelegate = {
  findMany: (a: unknown) => Promise<Article[]>;
  create: (a: { data: Record<string, unknown> }) => Promise<Article>;
  update: (a: { where: { id: string }; data: Record<string, unknown> }) => Promise<Article>;
  delete: (a: { where: { id: string } }) => Promise<unknown>;
};
function kb(): KbDelegate {
  return (prisma as unknown as { knowledgeArticle: KbDelegate }).knowledgeArticle;
}

// Какой раздел базы у этого чата: env KB_SPACE_BY_CHAT = "-100xxx:studio,-100yyy:salon".
export function spaceForChat(chatId: number | string): string {
  const map = process.env.KB_SPACE_BY_CHAT || "";
  for (const pair of map.split(",")) {
    const [id, sp] = pair.split(":").map((x) => x.trim());
    if (id && id === String(chatId)) return sp || "default";
  }
  return "default";
}

export async function listArticles(space?: string, q?: string): Promise<Article[]> {
  const where: Record<string, unknown> = {};
  if (space) where.space = space;
  const query = (q || "").trim();
  if (query) where.OR = [{ title: { contains: query, mode: "insensitive" } }, { body: { contains: query, mode: "insensitive" } }];
  return kb().findMany({ where, orderBy: { updatedAt: "desc" }, take: 500 }).catch(() => [] as Article[]);
}

// Количество статей по разделам (навигатор базы под масштаб).
export async function sectionCounts(): Promise<{ space: string; count: number }[]> {
  const arts = await listArticles();
  const m = new Map<string, number>();
  for (const a of arts) { const sp = a.space || "default"; m.set(sp, (m.get(sp) || 0) + 1); }
  return Array.from(m.entries()).map(([space, count]) => ({ space, count })).sort((a, b) => a.space.localeCompare(b.space));
}

// Отбор релевантных статей без эмбеддингов: по пересечению слов запроса с заголовком/текстом.
function kbTokens(str: string): string[] {
  return (str.toLowerCase().match(/[a-zа-яё0-9]{3,}/gi) || []);
}
function selectRelevant(articles: Article[], query: string, max = 15): Article[] {
  if (articles.length <= max) return articles;
  const qt = new Set(kbTokens(query));
  if (!qt.size) return articles.slice(0, max);
  const scored = articles.map((a) => {
    let score = 0;
    for (const t of kbTokens(a.body)) if (qt.has(t)) score += 1;
    for (const t of kbTokens(a.title)) if (qt.has(t)) score += 3;
    return { a, score };
  });
  scored.sort((x, y) => y.score - x.score);
  const top = scored.filter((x) => x.score > 0).slice(0, max).map((x) => x.a);
  return top.length ? top : articles.slice(0, max);
}

export async function listSpaces(): Promise<string[]> {
  const arts = await listArticles();
  return Array.from(new Set(arts.map((a) => a.space || "default"))).sort();
}

export async function upsertArticle(a: { id?: string; space: string; title: string; body: string; source?: string }): Promise<Article | null> {
  const data: Record<string, unknown> = { space: a.space || "default", title: a.title, body: a.body, source: a.source ?? "admin", updatedAt: new Date() };
  if (a.id) return kb().update({ where: { id: a.id }, data }).catch(() => null);
  return kb().create({ data }).catch(() => null);
}

export async function deleteArticle(id: string): Promise<boolean> {
  return kb().delete({ where: { id } }).then(() => true).catch(() => false);
}

function buildKbContext(articles: Article[]): string {
  if (!articles.length) return "";
  return articles.map((a) => `### ${a.title}\n${a.body}`).join("\n\n").slice(0, 12000);
}

export const COMMUNITY_RULES = `Сообщество: русскоязычные IT-предприниматели, живой обмен опытом по стартапам, венчуру, маркетингу. Тон: по-русски, на «ты», уважительно, без фамильярности, как к близким друзьям. Ценится: содержательные вопросы (новичок в первом сообщении кратко представляется — роль, опыт, запрос), обмен кейсами и реальной пользой. Не одобряется: реклама своих услуг («пишите в личку, сделаем»), сбор контактов участников, ссылки и хэштеги в общем чате, длинные простыни (>400 символов), пустой негатив без фактов, агрессия, троллинг, политика. Вакансии и поиск респондентов для касдева — в отдельных чатах. Анонимность не допускается: в профиле настоящее имя и фото.`;

function supportSystem(kbText: string, rules?: string): string {
  return `Ты — Ася, тёплый комьюнити-менеджер и агент поддержки сообщества в Telegram. Голос: по-доброму, на «ты», коротко, живым языком, без канцелярита и списков.
Правила и дух сообщества (соблюдай их в ответах и мягко направляй к ним): ${rules && rules.trim() ? rules : COMMUNITY_RULES}
Если новичок пишет впервые и не представился — мягко предложи коротко рассказать о себе (роль, опыт, запрос).
Задача — помогать участникам. На вопросы о продукте/сервисе (например, о панели «Студия») отвечай СТРОГО по базе знаний ниже, своими словами и по делу. Если ответа в базе нет — честно скажи, что уточнишь у команды, и НЕ выдумывай. На вопросы о правилах и приветствия отвечай тепло. Если сообщение не требует ответа менеджера (обычная болтовня, реакция, оффтоп без вопроса) — верни пустую строку.
${kbText ? `\nБаза знаний:\n${kbText}` : "\n(База знаний пока пуста — по продуктовым вопросам честно говори, что уточнишь у команды.)"}
Верни ТОЛЬКО текст ответа или пустую строку.`;
}

// Ответ комьюнити-менеджера/поддержки по базе знаний раздела. Пусто — если отвечать не нужно.
export async function communitySupportReply(text: string, space: string, rules?: string, repoUrl?: string): Promise<string> {
  const t = (text || "").trim();
  if (!t) return "";
  const [articles, repoCtx] = await Promise.all([listArticles(space), fetchRepoContext(repoUrl)]);
  let ctx = buildKbContext(selectRelevant(articles, t, 15));
  if (repoCtx) ctx = `${ctx}\n\n## Актуально из репозитория проекта (GitHub)\n${repoCtx}`.slice(0, 16000);
  const raw = await complete([{ role: "user", content: t.slice(0, 1000) }], supportSystem(ctx, rules), 400).catch(() => "");
  const out = (raw || "").trim();
  if (!out || out.length < 2 || /^["'«»]*$/.test(out)) return "";
  return out;
}

/* -------------------------------------------------------------------------- */
/* Знание Аси по видео проекта (саммари + главы с таймкодами) — бэкенд /api/ask */
/* Отдельно от базы статей поддержки выше: своя таблица VideoKnowledge.          */
/* -------------------------------------------------------------------------- */

export type VideoKnowledgeRow = {
  source: string; title: string | null; url: string | null; summary: string | null; chapters: string | null;
};
type VkDelegate = {
  upsert: (a: { where: Record<string, unknown>; create: Record<string, unknown>; update: Record<string, unknown> }) => Promise<unknown>;
  findMany: (a: { where: Record<string, unknown>; orderBy?: unknown; take?: number }) => Promise<VideoKnowledgeRow[]>;
};
function vkDb(): VkDelegate {
  return (prisma as unknown as { videoKnowledge: VkDelegate }).videoKnowledge;
}

export async function upsertVideoKnowledge(a: {
  clientId: string; source: string; title?: string; url?: string; summary?: string; chapters?: string;
}): Promise<void> {
  await vkDb()
    .upsert({
      where: { clientId_source: { clientId: a.clientId, source: a.source } },
      create: {
        clientId: a.clientId, source: a.source, title: a.title || null, url: a.url || null,
        summary: a.summary || null, chapters: a.chapters || null, updatedAt: new Date(),
      },
      update: {
        title: a.title ?? undefined, url: a.url ?? undefined,
        summary: a.summary ?? undefined, chapters: a.chapters ?? undefined, updatedAt: new Date(),
      },
    })
    .catch(() => {});
}

// Лексический поиск по знанию клиента (без векторов): скор по совпадению слов.
export async function searchKnowledge(clientId: string, q: string, take = 4): Promise<VideoKnowledgeRow[]> {
  const rows = await vkDb()
    .findMany({ where: { clientId }, orderBy: { updatedAt: "desc" }, take: 300 })
    .catch(() => [] as VideoKnowledgeRow[]);
  const terms = q.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3);
  if (!terms.length) return rows.slice(0, take);
  const scored = rows
    .map((r) => {
      const hay = `${r.title || ""} ${r.summary || ""} ${r.chapters || ""}`.toLowerCase();
      let score = 0;
      for (const t of terms) if (hay.includes(t)) score += 1;
      return { r, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, take).map((x) => x.r);
}

// Ответ Аси по найденному знанию: называет видео и тайм-код момента.
export async function answerFromKnowledge(q: string, rows: VideoKnowledgeRow[]): Promise<string> {
  if (!rows.length) return "Пока не нашла подходящего видео по этому вопросу. Попробуйте уточнить имя участника или тему.";
  const blocks = rows
    .map((r, i) => {
      let chapters = "";
      try {
        const arr = JSON.parse(r.chapters || "[]") as { start: number; title: string }[];
        chapters = arr.slice(0, 20).map((c) => `  ${vkMmss(Number(c.start) || 0)} — ${String(c.title || "")}`).join("\n");
      } catch { /* нет глав */ }
      return `Видео ${i + 1}: ${r.title || "без названия"}${r.url ? `\nСсылка: ${r.url}` : ""}${r.summary ? `\nО чём: ${r.summary}` : ""}${chapters ? `\nГлавы:\n${chapters}` : ""}`;
    })
    .join("\n\n");
  const system = `Ты — Ася, помощник фан-сайта по видео. Отвечай ТОЛЬКО по данным ниже (это видео проекта) — не выдумывай. Если есть подходящий момент, назови видео и тайм-код (мм:сс) главы, максимально близкой к вопросу. Отвечай коротко и дружелюбно, на русском. Если ничего не подходит — честно скажи, что не нашла.`;
  const user = `Вопрос: ${q}\n\nДанные:\n${blocks}`;
  const raw = await complete([{ role: "user", content: user.slice(0, 16000) }], system, 500).catch(() => "");
  return (raw || "").trim() || "Не удалось сформировать ответ, попробуйте ещё раз.";
}

function vkMmss(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
}
