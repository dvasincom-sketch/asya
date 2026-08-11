// Ася-саммари видео: транскрипт → краткое содержание, с кэшем по хэшу.
import crypto from "crypto";
import { complete } from "./timeweb";
import { prisma } from "./prisma";

export type SummaryResult = { tldr: string; points: string[] };
export type SummaryOut = SummaryResult & { hash: string; cached: boolean; chars: number };

type Row = { hash: string; summary: string; title: string | null; source: string | null; lang: string | null };
type Delegate = {
  findUnique: (a: { where: { hash: string } }) => Promise<Row | null>;
  upsert: (a: { where: { hash: string }; create: Record<string, unknown>; update: Record<string, unknown> }) => Promise<unknown>;
};
function db(): Delegate {
  return (prisma as unknown as { videoSummary: Delegate }).videoSummary;
}

function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function parseResult(raw: string): SummaryResult {
  const m = raw.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      const j = JSON.parse(m[0]) as { tldr?: unknown; points?: unknown };
      const tldr = typeof j.tldr === "string" ? j.tldr.trim() : "";
      const points = Array.isArray(j.points) ? j.points.map((x) => String(x).trim()).filter(Boolean).slice(0, 12) : [];
      if (tldr || points.length) return { tldr, points };
    } catch { /* ниже фолбэк */ }
  }
  return { tldr: raw.trim().slice(0, 600), points: [] };
}

async function generate(transcript: string, lang: string, instruction?: string, title?: string, context?: string, corrections?: string): Promise<SummaryResult> {
  const meta = [
    title && title.trim() ? `Название видео: ${title.trim()}` : "",
    context && context.trim() ? `Контекст: ${context.trim()}` : "",
  ].filter(Boolean).join("\n");

  const system = `Ты — Ася. По транскрипту видео сделай краткое содержание. Верни СТРОГО JSON без пояснений:
{"tldr":"1–2 предложения главной сути","points":["ключевой тезис","..."]}
Пиши на языке транскрипта${lang ? ` (${lang})` : ""}. 4–8 пунктов, коротко и по делу, без воды и без домыслов сверх сказанного в транскрипте.

СТРОГО ЗАПРЕЩЕНО включать в саммари (ни в tldr, ни в пунктах) служебные вставки, которые повторяются во всех роликах проекта и не относятся к содержанию именно этого видео:
— упоминания студии озвучки и фразы вида «озвучено студией…», названия студии;
— приглашения на Boosty, Telegram, соцсети и любые площадки; фразы «свежие видео выходят раньше на Boosty», «переводы выходят раньше», «ссылка в описании»;
— типовые приветствия-интро, прощания-аутро, дисклеймеры.
Пример того, чего НЕ должно быть в саммари: «Приглашает зрителей на Boosty», «Свежие переводы выходят на Boosty раньше», «озвучка студии …». Если в транскрипте есть только такие вставки и почти нет содержания — сделай короткое саммари по тому немногому, что реально сказано по теме, и НЕ добавляй эти вставки.

Саммари — только про то, что реально происходит и обсуждается в самом видео (что делает участник, о чём говорит, ключевые моменты).
Опирайся на название и контекст, чтобы правильно назвать участников и тему.${meta ? `\n\n${meta}` : ""}${instruction && instruction.trim() ? `\n\nДополнительные указания проекта (соблюдай их):\n${instruction.trim()}` : ""}${corrections && corrections.trim() ? `\n\nПримеры правок редактора проекта — соблюдай их стиль, факты и имена участников:\n${corrections.trim()}` : ""}`;
  const raw = await complete([{ role: "user", content: transcript.slice(0, 24000) }], system, 900).catch(() => "");
  return parseResult(raw || "");
}

// Главная функция: отдаёт из кэша или генерирует и кэширует.
export async function summarize(opts: { transcript: string; title?: string; source?: string; lang?: string; refresh?: boolean; instruction?: string; context?: string; corrections?: string }): Promise<SummaryOut> {
  const transcript = (opts.transcript || "").trim();
  const lang = (opts.lang || "").trim();
  const instruction = (opts.instruction || "").trim();
  const title = (opts.title || "").trim();
  const context = (opts.context || "").trim();
  const corrections = (opts.corrections || "").trim();
  // Хэш учитывает title/context/правки и версию промпта — при их смене саммари пересоберётся.
  const hash = sha256(`v5|${lang}|${instruction}|${title}|${context}|${corrections}|${transcript}`);
  const chars = transcript.length;

  if (!opts.refresh) {
    const hit = await db().findUnique({ where: { hash } }).catch(() => null);
    if (hit?.summary) {
      try { const r = JSON.parse(hit.summary) as SummaryResult; return { ...r, hash, cached: true, chars }; } catch { /* перегенерим */ }
    }
  }

  const result = await generate(transcript, lang, instruction, title, context, corrections);
  await db().upsert({
    where: { hash },
    create: { hash, title: opts.title || null, source: opts.source || null, lang: lang || null, summary: JSON.stringify(result), model: process.env.TIMEWEB_MODEL || null, updatedAt: new Date() },
    update: { summary: JSON.stringify(result), title: opts.title || null, source: opts.source || null, lang: lang || null, updatedAt: new Date() },
  }).catch(() => {});

  return { ...result, hash, cached: false, chars };
}
