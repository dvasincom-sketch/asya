// Ася-конструктор: сплошной текст → блоки страницы Content-box (capability "compose").
// В отличие от summary — интерактивный многошаговый разбор без кэша: автор
// присылает текст, получает предложенную разбивку, правит её в диалоге.
import { complete } from "./timeweb";
import type { ChatMessage } from "./crisis";

/** Блок в ответе (без id — id проставляет клиент, content-box). */
export type ComposeBlock = { type: string; [k: string]: unknown };
export type ComposeResult = { note: string; blocks: ComposeBlock[] };

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
4. Возвращаешь СТРОГО JSON вида {"note":"...","blocks":[...]} — без пояснений вокруг, без Markdown-обёртки.

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
- gallery {"type":"gallery","title"?:"Галерея"}
- videos {"type":"videos","title"?:"Видео"}
- categoryRow {"type":"categoryRow","title"?:""}
- publications {"type":"publications","title"?:""}
- button {"type":"button","label"?:"Текст кнопки"} (без href)

ФОРМАТИРОВАНИЕ ТЕКСТА (поля body, lead, callout.text, columns[].body)
Используй только Markdown: **жирный**, *курсив*, «## Подзаголовок», списки через «- », ссылки [текст](url) только если ссылка есть в исходном тексте. Абзацы разделяй пустой строкой. НЕ используй: цитаты >, код, таблицы, картинки, заголовки # или ###, HTML. Все прочие поля (label, value, title, year, name, строки factsList) — простой текст без разметки.

ПРАВИЛА
- Не выдумывай факты, даты, имена, цифры, которых нет в тексте. Лучше меньше блоков, чем додуманные.
- Не дублируй один и тот же контент в разных блоках.
- Начинай с hero, только если в тексте есть вводная часть (подзаголовок/лид). Если текст сразу «по делу» — hero можно не создавать.
- Разумное число блоков: обычно 3–12. Не дроби каждый абзац в отдельный text.
- Порядок блоков — как в исходном тексте.
- Заголовки блоков (title) — короткие, по-русски (или на языке текста).

ПОЛЕ note
Кратко (1–3 предложения) объясни автору своё видение: на сколько блоков разбил и почему. На последующих ходах — отвечай на правку автора и говори, что изменил. Пиши на языке автора.

ДИАЛОГ (правки)
Тебе могут прийти прошлый вариант блоков и сообщение автора с правками. Верни ПОЛНЫЙ обновлённый набор блоков (не дифф) с учётом правки и обнови note. Сохраняй то, что автор не просил менять.`;

/** Достаём первый JSON-объект из ответа модели. */
function parseResult(raw: string): ComposeResult {
  const m = raw.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      const j = JSON.parse(m[0]) as { note?: unknown; blocks?: unknown };
      const note = typeof j.note === "string" ? j.note.trim() : "";
      const blocks = Array.isArray(j.blocks) ? normalizeBlocks(j.blocks) : [];
      return { note, blocks };
    } catch {
      /* фолбэк ниже */
    }
  }
  return { note: raw.trim().slice(0, 500), blocks: [] };
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

  const msgs: ChatMessage[] = [
    { role: "user", content: `ИСХОДНЫЙ ТЕКСТ АВТОРА:\n\n${text.slice(0, 24000)}` },
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

  const raw = await complete(msgs, system, 2600).catch(() => "");
  return parseResult(raw || "");
}
