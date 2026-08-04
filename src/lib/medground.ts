// Заземление объяснений здоровья на медлитературу (Europe PMC). Никаких диагнозов и назначений:
// движок отдаёт тёплый общий пересказ в границах, а специфику по анализам человек решает с врачом.
// Кеш объяснений маркеров — в БД (почти статичны). Источники пользователю не показываем.
import { complete } from "./timeweb";
import { clean } from "./text";
import { prisma } from "./prisma";

type CacheDelegate = {
  findUnique: (a: { where: { key: string } }) => Promise<{ text: string } | null>;
  create: (a: { data: { key: string; code: string; direction: string; text: string } }) => Promise<unknown>;
};
function cacheDb(): CacheDelegate {
  return (prisma as unknown as { healthTermInfo: CacheDelegate }).healthTermInfo;
}

// Запрос к Europe PMC: берём обзоры (высокий уровень доказательности), возвращаем выдержки.
async function europePmc(term: string): Promise<string[]> {
  const q = encodeURIComponent(`${term} AND (PUB_TYPE:"review")`);
  const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${q}&format=json&resultType=core&pageSize=4`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 7000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
    if (!res.ok) {
      console.warn(`[medground] europepmc HTTP ${res.status}`);
      return [];
    }
    const data = (await res.json()) as { resultList?: { result?: Record<string, unknown>[] } };
    const items = data?.resultList?.result;
    if (!Array.isArray(items)) return [];
    const out: string[] = [];
    for (const it of items) {
      const ab = String(it.abstractText ?? "").trim();
      const ti = String(it.title ?? "").trim();
      if (ab) out.push(`${ti}: ${ab}`.slice(0, 1200));
      else if (ti) out.push(ti);
    }
    return out.slice(0, 4);
  } catch (e) {
    console.warn(`[medground] europepmc исключение: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

// Русское название маркера -> английский поисковый термин для литературы.
async function englishTerm(name: string, direction: string): Promise<string> {
  const hint = direction === "low" ? " (low / deficiency)" : direction === "high" ? " (high / elevated)" : "";
  const t = clean(
    await complete(
      [{ role: "user", content: `Лабораторный показатель: «${name}»${hint}` }],
      "Верни ТОЛЬКО английский медицинский поисковый термин (2–4 слова) для этого лабораторного показателя, без пояснений и кавычек.",
      30,
    ).catch(() => ""),
  )
    .replace(/["«»""]/g, "")
    .trim();
  return t.slice(0, 60) || name;
}

const BOUNDS =
  "СТРОГИЕ ЗАПРЕТЫ: не ставь диагноз, не утверждай причину именно у этого человека, не назначай лечение, добавки, " +
  "дозировки и диеты, не пугай, не приводи числовые нормы и дозы. Пиши обычным текстом без разметки, на «ты».";

// Объяснение маркера (для карточки в «Здоровье»). direction: low | high | general.
export async function explainMarker(code: string, name: string, direction: string): Promise<{ text: string; grounded: boolean }> {
  const dir = direction === "low" || direction === "high" ? direction : "general";
  const key = `${code}:${dir}`;

  const cached = await cacheDb().findUnique({ where: { key } }).catch(() => null);
  if (cached?.text) return { text: cached.text, grounded: true };

  const term = await englishTerm(name, dir);
  const snippets = await europePmc(term);
  const grounded = snippets.length > 0;

  const dirNote =
    dir === "low"
      ? "У человека ПОНИЖЕННОЕ значение — можешь в общих словах сказать, что в принципе стоит за низким уровнем (образ жизни, питание, сезон и т.п.), не утверждая, что именно у него. "
      : dir === "high"
        ? "У человека ПОВЫШЕННОЕ значение — можешь в общих словах сказать, что в принципе бывает при повышении, не утверждая, что именно у него. "
        : "";
  const sys =
    "Ты — Ася, тёплая внимательная подружка. Объясни простым русским, что это за показатель здоровья и что он в целом отражает. " +
    "2–4 коротких предложения, по-человечески, без сложных терминов. " +
    dirNote +
    BOUNDS +
    " " +
    (grounded
      ? "Опирайся на суть научных выдержек ниже, но перескажи простыми словами, без терминов и без ссылок."
      : "Достоверных источников под рукой нет — держись только общеизвестных, бесспорных основ и будь особенно осторожна.");
  const usr = grounded ? `Показатель: ${name}.\nНаучные выдержки (англ.):\n${snippets.join("\n\n")}` : `Показатель: ${name}.`;

  let text = clean(await complete([{ role: "user", content: usr }], sys, 320).catch(() => "")).trim();
  if (!text) text = "Про этот показатель мне сейчас нечего добавить бережно и точно — лучше уточнить его смысл у врача 🤍";

  // Кешируем только заземлённое — чтобы не закреплять осторожный фолбэк.
  if (grounded) await cacheDb().create({ data: { key, code, direction: dir, text } }).catch(() => {});
  return { text, grounded };
}

// Быстрый гейт: похоже ли сообщение на вопрос про показатель/термин здоровья.
const HEALTH_GATE =
  /(что так(ое|ое)|что значит|зачем нуж|для чего нуж|о ч[её]м говорит|почему.*(низк|высок|повыш|пониж)|это норма|нормальн)/i;
const HEALTH_TOPIC =
  /(витамин|гормон|железо|ферритин|холестерин|сахар|глюкоз|ттг|т4|т3|гемоглобин|лейкоцит|тромбоцит|креатинин|билирубин|соэ|инсулин|кортизол|пролактин|тестостерон|эстроген|анализ|показател|маркер|дефицит)/i;

// Заземление ответа в чате на мед-вопрос про термин. Возвращает фрагмент для system-prompt
// (или "" если это не про здоровье / нет источников). Классификатор зовём только при срабатывании гейта.
export async function groundHealthQuestion(text: string): Promise<string> {
  const t = (text || "").slice(0, 400);
  if (!(HEALTH_GATE.test(t) && HEALTH_TOPIC.test(t))) return "";

  const raw = await complete(
    [{ role: "user", content: t }],
    'Это сообщение — общий вопрос про медицинский показатель/термин? Верни СТРОГО JSON: {"health":true|false,"term":"английский поисковый термин 2–4 слова или пусто"}. health=true только если человек спрашивает, что означает показатель/термин в общем (не про свои конкретные цифры).',
    50,
  ).catch(() => "");
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return "";
  let term = "";
  try {
    const o = JSON.parse(m[0]) as { health?: unknown; term?: unknown };
    if (o.health !== true) return "";
    term = String(o.term ?? "").replace(/["«»""]/g, "").trim().slice(0, 60);
  } catch {
    return "";
  }
  if (term.length < 2) return "";

  const snippets = await europePmc(term);
  if (!snippets.length) return "";

  return (
    "\n\nСправка по теме здоровья из научных обзоров (перескажи простым русским, без терминов, без ссылок; " +
    BOUNDS +
    " Специфику по конкретным анализам человека мягко направляй в раздел «Здоровье»):\n" +
    snippets.join("\n\n").slice(0, 2400)
  );
}
