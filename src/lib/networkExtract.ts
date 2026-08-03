// Разговорное извлечение офферов/запросов (supply/demand) для сети «Ася-посредник».
// Только детекция + тёплое предложение. Ничего не пишется в БД и не брокерится
// без явного согласия человека (тап в карточке в чате). Стена приватности сохраняется:
// предлагаем оформить лишь то, что человек сам сказал вслух в этом сообщении.
import { complete } from "./timeweb";
import { clean } from "./text";
import { isCategory, categoryLive, CATEGORIES, type NetCategory } from "./network";

export type Detected = {
  kind: "offer" | "request";
  category: NetCategory;
  categoryLabel: string;
  categoryIcon: string;
  title: string;      // короткая суть (для оффера — чем полезен; для запроса — кого/что ищет)
  blurb: string;      // пара слов своими словами
  city: string;       // если прозвучал город/локация
  preview: string;    // как Ася тепло предложит оформить
};

const SYSTEM =
  "Ты — модуль-посредник тёплой Аси. По ПОСЛЕДНЕМУ сообщению человека реши, не прозвучало ли одно из двух: " +
  "(1) offer — человек сам умеет/предлагает услугу или навык (я массажист, я репетитор по математике, могу посидеть с ребёнком, я психолог); " +
  "(2) request — человек ищет человека или услугу (ищу няню на выходные, нужен тренер, посоветуйте психолога). " +
  "Категории: service (услуги и навыки), nanny (няни/уход за детьми), dating (знакомства с партнёром). " +
  "Определяй строго по сказанному, без домыслов. Если человек просто делится чувствами, жалуется, спрашивает совета " +
  "или ничего явно не предлагает и не ищет — верни kind \"none\". Не выдумывай город. " +
  "Верни СТРОГО JSON без пояснений: " +
  '{"kind":"offer|request|none","category":"service|nanny|dating","title":"…","blurb":"…","city":"…"}. ' +
  "title — до 6 слов на русском; blurb — тёплая фраза до 15 слов от лица человека; city — город или пусто.";

function warmPreview(kind: "offer" | "request", title: string): string {
  if (kind === "offer") {
    return `Слушай, а хочешь — я буду иногда предлагать тебя как «${title}» тем, кто ищет? Ты сама решишь по каждому, я ничего не раскрою без твоего да 🤍`;
  }
  return `Хочешь, я возьму это на себя и поищу — «${title}»? Возьму паузу, посмотрю, кто может подойти, и покажу только тех, кто сам согласится 🤍`;
}

// Возвращает найденное намерение или null. Никогда не бросает.
export async function detectNetworkIntent(userText: string): Promise<Detected | null> {
  if (process.env.NETWORK_ENABLED === "0") return null;
  if (process.env.NETWORK_DETECT === "0") return null;
  const text = userText.trim();
  if (text.length < 12) return null;

  const raw = await complete([{ role: "user", content: text }], SYSTEM, 220).catch(() => "");
  if (!raw) return null;
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;

  let o: { kind?: unknown; category?: unknown; title?: unknown; blurb?: unknown; city?: unknown };
  try {
    o = JSON.parse(m[0]);
  } catch {
    return null;
  }

  const kind = String(o.kind ?? "none");
  if (kind !== "offer" && kind !== "request") return null;
  const category = String(o.category ?? "");
  if (!isCategory(category)) return null;
  // Стена/предохранитель: предлагаем только там, где обмен реально включён (сейчас — услуги).
  if (!categoryLive(category)) return null;

  const title = clean(String(o.title ?? "")).slice(0, 60).trim();
  if (title.length < 2) return null;
  const blurb = clean(String(o.blurb ?? "")).slice(0, 140).trim();
  const city = clean(String(o.city ?? "")).slice(0, 60).trim();

  return {
    kind,
    category,
    categoryLabel: CATEGORIES[category].label,
    categoryIcon: CATEGORIES[category].icon,
    title,
    blurb,
    city,
    preview: warmPreview(kind, title),
  };
}
