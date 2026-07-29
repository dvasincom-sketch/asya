// Авто-извлечение фактов о человеке в «память» Асей + раскладка по темам.
import { complete } from "./timeweb";
import { prisma } from "./prisma";
import { TOPIC_NAMES, normalizeTopic } from "./topics";

export type Fact = { fact: string; topic: string };

const EXTRACT_SYSTEM =
  `Ты — модуль памяти тёплой подружки Аси. Из сообщения пользователя выдели устойчивые факты о нём, ` +
  `которые стоит помнить надолго: имя и род обращения, важные люди и питомцы, работа или учёба, ` +
  `что радует или тревожит, привычки, предпочтения, значимые события, сны. ` +
  `Не включай сиюминутные настроения, вопросы к Асе, общие или неопределённые фразы. ` +
  `Верни СТРОГО JSON-массив объектов вида {"fact":"…","topic":"…"}. ` +
  `fact — короткое утверждение на русском (до 8 слов). ` +
  `topic — ровно одно значение из списка: ${TOPIC_NAMES.join(", ")}. ` +
  `Пример: [{"fact":"Кота зовут Персик","topic":"Близкие"},{"fact":"Тревожно перед созвонами","topic":"Работа"}]. ` +
  `Если запоминать нечего — верни [].`;

// Мягкий доступ к Memory с полем topic (в песочнице клиент сгенерирован без него).
type MemoryCreateMany = {
  createMany: (a: { data: { userId: string; fact: string; topic?: string | null }[] }) => Promise<unknown>;
};
function memoryDb(): MemoryCreateMany {
  return prisma.memory as unknown as MemoryCreateMany;
}

// Извлекает факты с темами из текста пользователя. Никогда не бросает.
export async function extractFacts(userText: string): Promise<Fact[]> {
  const text = userText.trim();
  if (text.length < 8) return [];
  const raw = await complete([{ role: "user", content: text }], EXTRACT_SYSTEM, 320);
  if (!raw) return [];
  const m = raw.match(/\[[\s\S]*\]/);
  if (!m) return [];
  try {
    const arr: unknown = JSON.parse(m[0]);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((x) => {
        if (typeof x === "string") return { fact: x.trim(), topic: "Разное" };
        const o = x as { fact?: unknown; topic?: unknown };
        return { fact: String(o.fact ?? "").trim(), topic: normalizeTopic(o.topic) };
      })
      .filter((f) => f.fact.length > 1 && f.fact.length <= 80)
      .slice(0, 6);
  } catch {
    return [];
  }
}

// Извлекает факты и сохраняет новые (без дублей) в память пользователя.
export async function rememberFrom(userId: string, userText: string): Promise<void> {
  try {
    const facts = await extractFacts(userText);
    if (!facts.length) return;
    const existing = await prisma.memory.findMany({ where: { userId }, select: { fact: true } });
    const seen = new Set(existing.map((e: { fact: string }) => e.fact.toLowerCase()));
    const fresh = facts.filter((f) => !seen.has(f.fact.toLowerCase()));
    if (!fresh.length) return;
    await memoryDb().createMany({
      data: fresh.map((f) => ({ userId, fact: f.fact, topic: f.topic })),
    });
  } catch {
    /* память — не критично, тихо игнорируем сбой */
  }
}
