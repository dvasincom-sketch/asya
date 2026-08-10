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
