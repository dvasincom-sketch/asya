// Авто-извлечение фактов о человеке в «память» Асей.
import { complete } from "./timeweb";
import { prisma } from "./prisma";

const EXTRACT_SYSTEM = `Ты — модуль памяти тёплой подружки Аси. Из сообщения пользователя выдели устойчивые факты о нём, которые стоит помнить надолго: имя и род обращения, важные люди и питомцы, работа или учёба, что радует или тревожит, привычки, предпочтения, значимые события. Не включай сиюминутные настроения, вопросы к Асе, общие или неопределённые фразы. Верни СТРОГО JSON-массив коротких фактов на русском — каждый факт короткий (до 7 слов), сформулирован утверждением. Пример: ["Кота зовут Персик","Тревожно перед созвонами","Устаёт к пятнице"]. Если запоминать нечего — верни [].`;

// Извлекает факты из текста пользователя. Никогда не бросает.
export async function extractFacts(userText: string): Promise<string[]> {
  const text = userText.trim();
  if (text.length < 8) return [];
  const raw = await complete([{ role: "user", content: text }], EXTRACT_SYSTEM, 220);
  if (!raw) return [];
  const m = raw.match(/\[[\s\S]*\]/);
  if (!m) return [];
  try {
    const arr = JSON.parse(m[0]);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((x) => String(x).trim())
      .filter((x) => x.length > 1 && x.length <= 60)
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
    const fresh = facts.filter((f) => !seen.has(f.toLowerCase()));
    if (!fresh.length) return;
    await prisma.memory.createMany({ data: fresh.map((fact) => ({ userId, fact })) });
  } catch {
    /* память — не критично, тихо игнорируем сбой */
  }
}
