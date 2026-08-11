// Знание Аси по видео проекта: саммари + главы с таймкодами. Пополняется из
// content-box, используется для ответов «где посмотреть …» (эндпоинт /api/ask).
import { prisma } from "./prisma";
import { complete } from "./timeweb";

export type KnowledgeRow = {
  source: string; title: string | null; url: string | null; summary: string | null; chapters: string | null;
};
type Delegate = {
  upsert: (a: { where: Record<string, unknown>; create: Record<string, unknown>; update: Record<string, unknown> }) => Promise<unknown>;
  findMany: (a: { where: Record<string, unknown>; orderBy?: unknown; take?: number }) => Promise<KnowledgeRow[]>;
};
function db(): Delegate {
  return (prisma as unknown as { videoKnowledge: Delegate }).videoKnowledge;
}

export async function upsertVideoKnowledge(a: {
  clientId: string; source: string; title?: string; url?: string; summary?: string; chapters?: string;
}): Promise<void> {
  await db()
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
export async function searchKnowledge(clientId: string, q: string, take = 4): Promise<KnowledgeRow[]> {
  const rows = await db()
    .findMany({ where: { clientId }, orderBy: { updatedAt: "desc" }, take: 300 })
    .catch(() => [] as KnowledgeRow[]);
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
export async function answerFromKnowledge(q: string, rows: KnowledgeRow[]): Promise<string> {
  if (!rows.length) return "Пока не нашла подходящего видео по этому вопросу. Попробуйте уточнить имя участника или тему.";
  const blocks = rows
    .map((r, i) => {
      let chapters = "";
      try {
        const arr = JSON.parse(r.chapters || "[]") as { start: number; title: string }[];
        chapters = arr
          .slice(0, 20)
          .map((c) => `  ${mmss(Number(c.start) || 0)} — ${String(c.title || "")}`)
          .join("\n");
      } catch { /* нет глав */ }
      return `Видео ${i + 1}: ${r.title || "без названия"}${r.url ? `\nСсылка: ${r.url}` : ""}${r.summary ? `\nО чём: ${r.summary}` : ""}${chapters ? `\nГлавы:\n${chapters}` : ""}`;
    })
    .join("\n\n");
  const system = `Ты — Ася, помощник фан-сайта по видео. Отвечай ТОЛЬКО по данным ниже (это видео проекта) — не выдумывай. Если есть подходящий момент, назови видео и тайм-код (мм:сс) главы, максимально близкой к вопросу. Отвечай коротко и дружелюбно, на русском. Если ничего не подходит — честно скажи, что не нашла.`;
  const user = `Вопрос: ${q}\n\nДанные:\n${blocks}`;
  const raw = await complete([{ role: "user", content: user.slice(0, 16000) }], system, 500).catch(() => "");
  return (raw || "").trim() || "Не удалось сформировать ответ, попробуйте ещё раз.";
}

function mmss(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
}
