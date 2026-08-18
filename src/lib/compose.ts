// Ася-конструктор: сплошной текст → блоки страницы Content-box (capability "compose").
// В отличие от summary — интерактивный многошаговый разбор без кэша: автор
// присылает текст, получает предложенную разбивку, правит её в диалоге.
import { complete } from "./timeweb";
import type { ChatMessage } from "./crisis";

/** Блок в ответе (без id — id проставляет клиент, content-box). */
export type ComposeBlock = { type: string; [k: string]: unknown };
export type ComposeSuggest = { title?: string; tags?: string[] };
export type ComposeResult = { note: string; blocks: ComposeBlock[]; suggest?: ComposeSuggest };

/** Нормализация предложения заголовка/тегов. */
function parseSuggest(v: unknown): ComposeSuggest | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as { title?: unknown; tags?: unknown };
  const title = typeof o.title === "string" ? o.title.trim().slice(0, 160) : "";
  const tags = Array.isArray(o.tags) ? o.tags.map((x) => String(x).trim()).filter(Boolean).slice(0, 8) : [];
  if (!title && !tags.length) return undefined;
  return { ...(title ? { title } : {}), ...(tags.length ? { tags } : {}) };
}

/** Типы, которые ИИ имеет право создавать (текстовые + пустые плейсхолдеры). */
const ALLOWED = new Set([
  "hero", "facts", "text", "timeline", "relations", "awards",
  "factsList", "columns", "callout", "divider",
  "gallery", "videos", "categoryRow", "publications", "button",
]);

const SYSTEM = `Ты — редактор-структуровщик платформы Content-box. Автор присылает сплошной текст (черновик статьи, биографию, обзор, сценарий). Твоя задача — разложить его на блоки конструктора страницы, не выдумывая фактов и не теряя смысла.

ЧТО ТЫ ДЕЛАЕШЬ
1. Читаешь текст и делишь его на логические части.
2. Каждой части подбираешь наиболее подходящий тип блока из каталога ниже.
3. Переносишь содержание в поля блока дословно по смыслу: перефразируешь только ради краткости заголовков и подписей, но НЕ добавляешь того, чего в тексте нет.
4. Возвращаешь ТОЛЬКО JSON вида {"blocks":[...],"note":"...","suggest":{"title":"вариант заголовка публикации","tags":["тег","тег"]}} — БЕЗ вводных фраз до и после, БЕЗ обёртки в тройные кавычки. Не пиши ничего вне JSON. Поле note — не длиннее 2 коротких предложений. Поле suggest — необязательное: предложи заголовок публикации и 2–5 тегов по тексту (если неясно — опусти).

КАТАЛОГ БЛОКОВ (type → назначение → поля)
- hero — вводная шапка страницы. {"type":"hero","eyebrow"?:"надзаголовок","subtitle"?:"подзаголовок","lead"?:"короткий лид (Markdown)"}. Крупный заголовок берётся из названия публикации — сюда его НЕ дублируй.
- facts — карточки «метка → значение» (год рождения, жанр, страна…). {"type":"facts","title"?:"","items":[{"label":"Метка","value":"Значение"}]}
- text — обычный раздел с заголовком и абзацами. {"type":"text","title"?:"Заголовок раздела","body":"Абзацы в Markdown"}
- timeline — хронология/этапы по годам. {"type":"timeline","title"?:"","items":[{"year":"2019","title":"Событие","text"?:"описание"}]}
- relations — аккордеон (разворачиваемые пункты: заголовок + текст). Подходит для FAQ, разделов-справок. {"type":"relations","title"?:"","items":[{"name":"Заголовок пункта","text":"Текст пункта"}]}
- awards — плашки (короткие достижения/пункты с подписью). {"type":"awards","title"?:"","items":[{"title":"Заголовок","subtitle"?:"подпись"}]}
- factsList — нумерованные плитки (список фактов/тезисов). {"type":"factsList","title"?:"","items":["Факт один","Факт два"]}
- columns — текст в 2–3 колонки (сравнение, «за/против», параллельные темы). {"type":"columns","title"?:"","cols":[{"title"?:"","body":"Markdown"},{"title"?:"","body":"Markdown"}]}
- callout — выделенная выноска или цитата. {"type":"callout","variant"?:"quote|note","text":"Короткий текст (Markdown)","author"?:"автор цитаты"}
- divider — разделитель между смысловыми зонами. {"type":"divider","variant"?:"line|dots|space"}

БЛОКИ-ПЛЕЙСХОЛДЕРЫ (создаёшь ПУСТЫМИ, только если по смыслу текста там явно просится медиа; НЕ придумывай ссылки, файлы, категории):
- gallery {"type":"gallery","title"?:"Галерея","hint"?:"какие фото сюда"}
- videos {"type":"videos","title"?:"Видео","hint"?:"какие ролики сюда"}
- categoryRow {"type":"categoryRow","title"?:"","hint"?:"какую категорию показать"}
- publications {"type":"publications","title"?:"","hint"?:"какие материалы прикрепить"}
- button {"type":"button","label"?:"Текст кнопки"} (без href)
Для медиа-плейсхолдеров ЗАПОЛНЯЙ короткое поле hint — подсказку автору, что туда вставить, по смыслу текста (напр. «фото с концерта», «клип на песню»).

ФОРМАТИРОВАНИЕ ТЕКСТА (поля body, lead, callout.text, columns[].body)
Используй только Markdown: **жирный**, *курсив*, «## Подзаголовок», списки через «- », ссылки [текст](url) только если ссылка есть в исходном тексте. Абзацы разделяй пустой строкой. НЕ используй: цитаты >, код, таблицы, картинки, заголовки # или ###, HTML. Все прочие поля (label, value, title, year, name, строки factsList) — простой текст без разметки.

ПРАВИЛА
- ПЕРЕНОСИ ТЕКСТ ДОСЛОВНО: сохраняй ВСЕ предложения, факты, детали и объём исходника. НЕ сокращай, НЕ пересказывай, НЕ выкидывай абзацы, НЕ переписывай стиль. Твоя задача — разложить текст по блокам, а не сжать его. Единственные допустимые изменения — короткие заголовки блоков и минимальная разметка (**жирный**/*курсив*).
- Не выдумывай факты, даты, имена, цифры, которых нет в тексте. Лучше меньше блоков, чем додуманные.
- Не дублируй один и тот же контент в разных блоках.
- Начинай с hero, только если в тексте есть вводная часть (подзаголовок/лид). Если текст сразу «по делу» — hero можно не создавать.
- Разумное число блоков: обычно 3–12. Не дроби каждый абзац в отдельный text.
- Порядок блоков — как в исходном тексте.
- Заголовки блоков (title) — короткие, по-русски (или на языке текста).

ПОЛЕ note
Кратко (1–3 предложения) объясни автору своё видение: на сколько блоков разбил и почему. На последующих ходах — отвечай на правку автора и говори, что изменил. Пиши на языке автора.

ДИАЛОГ (правки)
Тебе могут прийти прошлый вариант блоков и сообщение автора с правками. Верни ПОЛНЫЙ обновлённый набор блоков (не дифф) с учётом правки и обнови note. Сохраняй то, что автор не просил менять.

ВАЖНО: первый символ твоего ответа — открывающая фигурная скобка «{». Не пиши НИ ОДНОГО слова, приветствия или пояснения до JSON и после него. Только JSON-объект.`;

/** Достаём первый JSON-объект из ответа модели. */
/** Сбалансированный JSON-объект от первого '{' (учёт строк и экранирования). */
function extractBalanced(t: string): string | null {
  const i = t.indexOf("{");
  if (i < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let k = i; k < t.length; k++) {
    const ch = t[k];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) return t.slice(i, k + 1); }
  }
  return null;
}

/**
 * Частичное восстановление: собрать блоки из массива "blocks", даже если хвост
 * ответа обрезан лимитом токенов. Берём каждый полностью пришедший объект {...}
 * и останавливаемся на первом незакрытом.
 */
function salvageBlocks(t: string): ComposeBlock[] {
  const bi = t.indexOf('"blocks"');
  if (bi < 0) return [];
  const arrStart = t.indexOf("[", bi);
  if (arrStart < 0) return [];
  const out: ComposeBlock[] = [];
  let k = arrStart + 1;
  while (k < t.length) {
    while (k < t.length && (t[k] === " " || t[k] === "\n" || t[k] === "\r" || t[k] === "\t" || t[k] === ",")) k++;
    if (k >= t.length || t[k] === "]") break;
    if (t[k] !== "{") break;
    let depth = 0, inStr = false, esc = false, end = -1;
    for (let p = k; p < t.length; p++) {
      const ch = t[p];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
      } else if (ch === '"') inStr = true;
      else if (ch === "{") depth++;
      else if (ch === "}") { depth--; if (depth === 0) { end = p; break; } }
    }
    if (end < 0) break; // объект не закрыт (обрыв) — дальше не идём
    try {
      const o = JSON.parse(t.slice(k, end + 1));
      if (o && typeof o === "object") out.push(o as ComposeBlock);
    } catch { break; }
    k = end + 1;
  }
  return out;
}

function parseResult(raw: string): ComposeResult {
  let t = String(raw || "").trim();
  // снимаем возможную \`\`\`json ... \`\`\` обёртку
  const fence = t.match(/\`\`\`(?:json)?\s*([\s\S]*?)\`\`\`/i);
  if (fence) t = fence[1].trim();
  const tryParse = (str: string): { note?: unknown; blocks?: unknown } | null => {
    try { return JSON.parse(str) as { note?: unknown; blocks?: unknown }; } catch { return null; }
  };
  let j = tryParse(t);
  if (!j) { const b = extractBalanced(t); if (b) j = tryParse(b); }
  if (!j) { const m = t.match(/\{[\s\S]*\}/); if (m) j = tryParse(m[0]); }
  if (j && typeof j === "object") {
    const note = typeof j.note === "string" ? j.note.trim() : "";
    const blocks = Array.isArray(j.blocks) ? normalizeBlocks(j.blocks) : [];
    const suggest = parseSuggest((j as { suggest?: unknown }).suggest);
    if (note || blocks.length) return { note, blocks, suggest };
  }
  // Полный парс не удался (обрыв/мусор) — спасаем целиком пришедшие блоки.
  const salvaged = normalizeBlocks(salvageBlocks(t));
  if (salvaged.length) {
    const nm = t.match(/"note"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const note = nm ? nm[1].replace(/\\"/g, '"').slice(0, 400) : "";
    return { note, blocks: salvaged };
  }
  return { note: t.slice(0, 500), blocks: [] };
}

/** Лёгкая нормализация: только валидные типы, каждый блок — объект. Строгий
 *  санитайз (Markdown, длины, id) — на стороне content-box. */
function normalizeBlocks(arr: unknown[]): ComposeBlock[] {
  const out: ComposeBlock[] = [];
  for (const raw of arr) {
    if (!raw || typeof raw !== "object") continue;
    const b = raw as Record<string, unknown>;
    const type = typeof b.type === "string" ? b.type : "";
    if (!ALLOWED.has(type)) continue;
    out.push({ ...b, type } as ComposeBlock);
    if (out.length >= 40) break;
  }
  return out;
}

/**
 * Разобрать текст на блоки. messages — предыдущие реплики диалога (правки автора
 * и заметки ассистента), prevBlocks — последний предложенный вариант (для правки).
 */
/** Разбивка длинного текста на части по границам абзацев (~maxChars символов). */
function chunkText(text: string, maxChars: number): string[] {
  const paras = text.split(/\n{2,}/);
  const chunks: string[] = [];
  let buf = "";
  for (const p of paras) {
    if (buf && buf.length + p.length + 2 > maxChars) { chunks.push(buf); buf = ""; }
    buf = buf ? buf + "\n\n" + p : p;
    while (buf.length > maxChars * 1.5) { chunks.push(buf.slice(0, maxChars)); buf = buf.slice(maxChars); }
  }
  if (buf.trim()) chunks.push(buf);
  return chunks.length ? chunks : [text];
}

export async function composeBlocks(opts: {
  text: string;
  messages?: { role: string; content: string }[];
  prevBlocks?: unknown[];
  lang?: string;
  instruction?: string;
  corrections?: string;
}): Promise<ComposeResult> {
  const text = (opts.text || "").trim();
  const lang = (opts.lang || "").trim();
  const instruction = (opts.instruction || "").trim();
  const corrections = (opts.corrections || "").trim();

  const system =
    SYSTEM +
    (lang ? `\n\nЯзык автора: ${lang}.` : "") +
    (instruction ? `\n\nДополнительные указания проекта (соблюдай их):\n${instruction}` : "") +
    (corrections ? `\n\nПримеры правок редактора проекта — учитывай их стиль:\n${corrections}` : "");

  const isRefine =
    (Array.isArray(opts.prevBlocks) && opts.prevBlocks.length > 0) ||
    (Array.isArray(opts.messages) && opts.messages.length > 0);

  // Первый разбор длинного текста — по частям: одним вызовом модель упирается в
  // лимит вывода и режет хвост (текст «уменьшается»). По частям переносим весь объём.
  if (!isRefine && text.length > 9000) {
    const chunks = chunkText(text, 8000);
    const allBlocks: ComposeBlock[] = [];
    let note = "";
    let suggest: ComposeSuggest | undefined;
    for (let i = 0; i < chunks.length; i++) {
      const first = i === 0;
      const sys =
        system +
        (first
          ? ""
          : `\n\nЭто ПРОДОЛЖЕНИЕ большого текста, часть ${i + 1} из ${chunks.length}. НЕ создавай hero и facts — только блоки содержания (text, timeline, relations, awards, factsList, columns, callout, divider) по этому фрагменту. Перенеси текст фрагмента ДОСЛОВНО.`);
      const raw = await complete([{ role: "user", content: `ФРАГМЕНТ ТЕКСТА:\n\n${chunks[i]}` }], sys, 6000).catch(() => "");
      const r = parseResult(raw || "");
      if (first) { note = r.note; suggest = r.suggest; }
      for (const b of r.blocks) {
        if (!first && (b.type === "hero" || b.type === "facts")) continue;
        allBlocks.push(b);
      }
      if (allBlocks.length >= 60) break;
    }
    return {
      note: note || `Разобрал текст на ${allBlocks.length} блоков (в ${chunks.length} частях), перенося содержание дословно.`,
      blocks: allBlocks.slice(0, 60),
      suggest,
    };
  }

  const msgs: ChatMessage[] = [
    { role: "user", content: `ИСХОДНЫЙ ТЕКСТ АВТОРА:\n\n${text.slice(0, 40000)}` },
  ];
  if (Array.isArray(opts.prevBlocks) && opts.prevBlocks.length) {
    msgs.push({
      role: "assistant",
      content: JSON.stringify({ note: "", blocks: opts.prevBlocks }).slice(0, 20000),
    });
  }
  for (const m of opts.messages || []) {
    const role = m?.role === "assistant" ? "assistant" : "user";
    const content = String(m?.content || "").slice(0, 4000);
    if (content) msgs.push({ role, content } as ChatMessage);
  }

  const raw = await complete(msgs, system, 6000).catch(() => "");
  return parseResult(raw || "");
}
