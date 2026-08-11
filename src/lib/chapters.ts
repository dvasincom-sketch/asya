// Ася-полировка глав видео: сырые авто-главы (первая фраза из распознанной речи)
// → короткие человекочитаемые заголовки. Вход — сегменты { start, text } по
// главам, выход — по одному заголовку на сегмент (тот же порядок и длина).
// Без БД-кэша: заголовки дёшевы, а результат кэширует у себя вызывающая сторона.
import { complete } from "./timeweb";

export type ChapterSeg = { start: number; text: string };

function mmss(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function clampTitle(s: string): string {
  const t = String(s || "").replace(/\s+/g, " ").replace(/^["'«»\-–—•\d.\)\s]+/, "").trim();
  const cut = t.length > 60 ? t.slice(0, 57).trim() + "…" : t;
  return cut.charAt(0).toUpperCase() + cut.slice(1);
}

// Парсим ответ модели в массив заголовков ровно длины n (порядок сохраняем).
function parseTitles(raw: string, n: number): string[] {
  const out: string[] = [];
  const m = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (m) {
    try {
      const j = JSON.parse(m[0]) as unknown;
      const arr = Array.isArray(j)
        ? j
        : Array.isArray((j as { titles?: unknown }).titles)
          ? (j as { titles: unknown[] }).titles
          : [];
      for (const x of arr) out.push(clampTitle(String(x)));
    } catch { /* фолбэк ниже */ }
  }
  // Ровно n элементов: недостающие — пустые (вызывающая сторона оставит старый заголовок).
  return Array.from({ length: n }, (_, i) => out[i] || "");
}

export async function titleChapters(opts: {
  segments: ChapterSeg[];
  title?: string;
  lang?: string;
  instruction?: string;
}): Promise<{ titles: string[] }> {
  const segs = (opts.segments || []).slice(0, 40);
  if (!segs.length) return { titles: [] };
  const lang = (opts.lang || "").trim();
  const instruction = (opts.instruction || "").trim();

  const system = `Ты — Ася. Тебе дают список глав видео: у каждой время начала и расшифровка речи из этого фрагмента (распознавание неточное, бывают повторы и мусор). Придумай для КАЖДОЙ главы короткий осмысленный заголовок (2–6 слов), отражающий суть фрагмента. Не нумеруй, не добавляй время, не выдумывай сверх сказанного. Если фрагмент — песня/музыка/пустой, назови его нейтрально («Музыкальная вставка», «Заставка» и т.п.).
Верни СТРОГО JSON без пояснений: {"titles":["Заголовок 1","Заголовок 2", ...]} — РОВНО ${segs.length} элементов в том же порядке.
Пиши на языке расшифровки${lang ? ` (${lang})` : ""}.${instruction ? `\n\nДополнительные указания проекта (соблюдай их):\n${instruction}` : ""}`;

  const user = (opts.title ? `Видео: ${opts.title}\n\n` : "") +
    segs.map((s, i) => `${i + 1}. [${mmss(s.start)}] ${String(s.text || "").replace(/\s+/g, " ").trim().slice(0, 600)}`).join("\n");

  const raw = await complete([{ role: "user", content: user.slice(0, 24000) }], system, 900).catch(() => "");
  return { titles: parseTitles(raw || "", segs.length) };
}

/* -------------------------------------------------------------------------- */
/* Построение глав «с нуля»: из полной расшифровки с таймкодами Ася сама делит  */
/* видео на осмысленные главы и точно определяет время начала каждой.           */
/* -------------------------------------------------------------------------- */

export type BuildCue = { start: number; text: string };

// "123" (сек) | "m:ss" | "h:mm:ss" → секунды.
function toSec(x: unknown): number {
  if (typeof x === "number") return Math.max(0, Math.floor(x));
  const t = String(x || "").trim();
  if (/^\d+$/.test(t)) return Number(t);
  const m = t.match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})$/);
  if (!m) return NaN;
  const h = m[1] ? Number(m[1]) : 0;
  return h * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

// Ответ модели → нормализованные главы (сорт по времени, дедуп близких, первая с 0).
function parseChapters(raw: string): { start: number; title: string }[] {
  const m = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!m) return [];
  let arr: unknown[] = [];
  try {
    const j = JSON.parse(m[0]) as unknown;
    arr = Array.isArray(j)
      ? j
      : Array.isArray((j as { chapters?: unknown }).chapters)
        ? (j as { chapters: unknown[] }).chapters
        : [];
  } catch {
    return [];
  }
  const out: { start: number; title: string }[] = [];
  for (const x of arr) {
    const o = (x || {}) as { start?: unknown; title?: unknown };
    const start = toSec(o.start);
    const title = clampTitle(String(o.title || ""));
    if (Number.isFinite(start) && title) out.push({ start, title });
  }
  out.sort((a, b) => a.start - b.start);
  // Дедуп слишком близких границ (< 5 c) — оставляем первую.
  const dedup: { start: number; title: string }[] = [];
  for (const c of out) {
    if (!dedup.length || c.start - dedup[dedup.length - 1].start >= 5) dedup.push(c);
  }
  if (dedup.length) dedup[0] = { ...dedup[0], start: 0 };
  return dedup;
}

/**
 * Строим главы из полной расшифровки. На вход — реплики с таймкодами
 * (start в секундах + text). Ася сама решает границы глав по смыслу и возвращает
 * [{ start, title }]. Границы — по возрастанию, первая с 0, 4–12 глав.
 */
export async function buildChapters(opts: {
  cues: BuildCue[];
  title?: string;
  lang?: string;
  instruction?: string;
  context?: string;
}): Promise<{ chapters: { start: number; title: string }[] }> {
  const cues = (opts.cues || [])
    .map((c) => ({ start: Number(c.start) || 0, text: String(c.text || "").replace(/\s+/g, " ").trim() }))
    .filter((c) => c.text.length > 0)
    .slice(0, 800);
  if (cues.length < 4) return { chapters: [] };

  const lang = (opts.lang || "").trim();
  const instruction = (opts.instruction || "").trim();
  const context = (opts.context || "").trim();
  const durMin = Math.max(1, Math.round(cues[cues.length - 1].start / 60));

  const system = `Ты — Ася. Тебе дают полную расшифровку речи видео: строки вида [мм:сс] текст (распознавание неточное, бывают повторы и мусор). Раздели видео на осмысленные ГЛАВЫ по темам, сценам или смысловым блокам — как оглавление, по которому зрителю удобно ориентироваться.
Для каждой главы верни время начала (строкой ровно как метка из расшифровки, напр. "7:57" или "1:02:50") и короткий заголовок из 2–6 слов, отражающий суть фрагмента (НЕ первую попавшуюся фразу).
Правила: делай 4–12 глав на всё видео (для ~${durMin} мин ориентир — одна глава на 6–12 минут); первая глава начинается с 0; время строго по возрастанию; объединяй связные куски, не дроби на отдельные реплики; не выдумывай сверх сказанного; музыку/заставки помечай нейтрально («Музыкальная вставка», «Заставка»).
Верни СТРОГО JSON без пояснений: {"chapters":[{"start":"0:00","title":"…"},{"start":"7:57","title":"…"}]}. Пиши на языке расшифровки${lang ? ` (${lang})` : ""}.${context ? `\n\nКонтекст видео: ${context}` : ""}${instruction ? `\n\nДополнительные указания проекта (соблюдай их):\n${instruction}` : ""}`;

  const user =
    (opts.title ? `Видео: ${opts.title}\n\n` : "") +
    cues.map((c) => `[${mmss(c.start)}] ${c.text.slice(0, 300)}`).join("\n");

  const raw = await complete([{ role: "user", content: user.slice(0, 24000) }], system, 1400).catch(() => "");
  return { chapters: parseChapters(raw || "") };
}
