// Темы базы знаний. Ася сама раскладывает факты по этим темам — человек ничего не сортирует.
export const TOPICS: { name: string; icon: string }[] = [
  { name: "Работа", icon: "💼" },
  { name: "Отношения", icon: "💗" },
  { name: "Состояния", icon: "🌊" },
  { name: "Забота о себе", icon: "🕊" },
  { name: "Сны", icon: "🌙" },
  { name: "Идеи", icon: "✨" },
  { name: "Решения", icon: "⚖️" },
  { name: "Итоги периода", icon: "🪞" },
  { name: "Здоровье", icon: "🌿" },
  { name: "Близкие", icon: "🏡" },
  { name: "Разное", icon: "🤍" },
];

export const TOPIC_NAMES = TOPICS.map((t) => t.name);

export function topicIcon(name: string): string {
  return TOPICS.find((t) => t.name === name)?.icon ?? "🤍";
}

// Приводим тему от модели к списку (иначе — «Разное»).
export function normalizeTopic(raw: unknown): string {
  const s = String(raw ?? "").trim();
  const hit = TOPIC_NAMES.find((n) => n.toLowerCase() === s.toLowerCase());
  return hit ?? "Разное";
}
