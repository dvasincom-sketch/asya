// Кризисный фильтр, слой 1 (быстрые правила). Слой 2 (классификатор) — на следующих шагах.
export type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

export type Contact = { phone: string; label: string; note?: string };
export type CrisisReply = { type: "crisis"; text: string; contacts: Contact[] };

const CRISIS_RE =
  /(не хочу (жить|больше жить)|покончить|свести сч[её]ты|убить себя|суицид|повеситься|не вижу смысла жить|хочу умереть|лучше без меня|причинить себе вред|порезать себя)/i;

export function detectCrisis(text: string): boolean {
  return CRISIS_RE.test(text || "");
}

export const CRISIS_REPLY: CrisisReply = {
  type: "crisis",
  text:
    "Спасибо, что говоришь мне об этом. Я слышу, как тебе сейчас невыносимо тяжело — и я рядом. С этим не нужно справляться в одиночку. Рядом есть люди, которые умеют помочь именно в такие моменты 🤍",
  contacts: [
    { phone: "88002000122", label: "8-800-2000-122", note: "телефон доверия · анонимно" },
    { phone: "112", label: "112", note: "если совсем невыносимо" },
  ],
};
