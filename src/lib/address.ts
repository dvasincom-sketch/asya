// Единый источник правды для грамматического рода обращения к человеку.
// Ася про себя всегда «она» (женский) — это не трогаем; здесь только про то,
// как Ася ОБРАЩАЕТСЯ к пользователю: «ты сам/сама», «полезен/полезна» и т.п.
import { prisma } from "./prisma";

export type Gender = "female" | "male" | null | undefined;

// Выбор формы по роду. n — нейтральная запасная форма (когда род неизвестен).
// Если нейтральная не задана — берём женскую (историческая аудитория Аси — преимущественно женская),
// но по возможности всегда передавай нейтральный вариант.
export function g(gender: Gender, female: string, male: string, neutral?: string): string {
  if (gender === "male") return male;
  if (gender === "female") return female;
  return neutral ?? female;
}

// Распознать род из явной фразы человека («в мужском роде», «я женщина» и т.п.).
export function detectGenderFromText(text: string): Gender {
  const t = (text || "").toLowerCase();
  if (/мужск|в м\.?\s?роде|я парень|я мужчина|обращайся.*(муж|он\b)/.test(t)) return "male";
  if (/женск|в ж\.?\s?роде|я девушка|я женщина|обращайся.*(жен|она\b)/.test(t)) return "female";
  return null;
}

// Распознать род из уже сохранённых фактов памяти / ответов профиля.
export function detectGenderFromFacts(facts: string[]): Gender {
  for (const f of facts) {
    const gg = detectGenderFromText(f);
    if (gg) return gg;
  }
  return null;
}

type UserGender = { gender: string | null };
function userGenderDb() {
  return prisma.user as unknown as {
    findUnique: (a: { where: { id: string }; select: { gender: boolean } }) => Promise<UserGender | null>;
    update: (a: { where: { id: string }; data: { gender: string } }) => Promise<unknown>;
  };
}

// Установить род, если он ещё не известен (idempotent).
export async function setGenderIfEmpty(userId: string, gender: Gender): Promise<void> {
  if (gender !== "male" && gender !== "female") return;
  await userGenderDb().update({ where: { id: userId }, data: { gender } }).catch(() => {});
}

// Достать род: сначала из User.gender; если пусто — восстановить из памяти и профиля
// (то, что Ася и так знает), сохранить и вернуть. Единая точка для всех поверхностей.
export async function resolveGender(userId: string): Promise<Gender> {
  const u = await userGenderDb().findUnique({ where: { id: userId }, select: { gender: true } }).catch(() => null);
  if (u?.gender === "male" || u?.gender === "female") return u.gender;

  const facts = await prisma.memory
    .findMany({ where: { userId }, select: { fact: true }, take: 60 })
    .catch(() => [] as { fact: string }[]);
  let gg = detectGenderFromFacts(facts.map((f) => f.fact));

  if (!gg) {
    const pa = await (
      prisma as unknown as {
        profileAnswer: { findMany: (a: { where: { userId: string } }) => Promise<{ value: string }[]> };
      }
    ).profileAnswer.findMany({ where: { userId } }).catch(() => [] as { value: string }[]);
    gg = detectGenderFromFacts(pa.map((x) => x.value));
  }

  if (gg) await setGenderIfEmpty(userId, gg);
  return gg;
}
