// Гибкие роли бота: роль = набор возможностей (capabilities). Редактируется из админки, расширяемо.
// Безопасно к недоступной БД: при сбое отдаём встроенные дефолты, поведение вебхука не меняется.
import { prisma } from "./prisma";

export type Caps = {
  support: boolean;    // отвечает на вопросы по базе знаний/репозиторию
  moderation: boolean; // удаляет ссылки/хэштеги/длинные/«+»/спам
  captcha: boolean;    // проверяет новичков (капча по первому сообщению)
};
export type Role = { key: string; title: string; caps: Caps; builtin: boolean };

export const CAP_LABELS: { key: keyof Caps; title: string; hint: string }[] = [
  { key: "support", title: "Поддержка", hint: "Отвечает на вопросы участников по базе знаний и репозиторию" },
  { key: "moderation", title: "Модерация", hint: "Удаляет ссылки, хэштеги, длинные сообщения, «+» и спам" },
  { key: "captcha", title: "Капча новичков", hint: "Проверяет новичка по первому сообщению, что он человек" },
];

export const BUILTIN_ROLES: Role[] = [
  { key: "off", title: "Выключена", caps: { support: false, moderation: false, captcha: false }, builtin: true },
  { key: "support", title: "Поддержка (без модерации)", caps: { support: true, moderation: false, captcha: false }, builtin: true },
  { key: "moderation", title: "Модерация", caps: { support: false, moderation: true, captcha: true }, builtin: true },
  { key: "both", title: "Модерация + поддержка", caps: { support: true, moderation: true, captcha: true }, builtin: true },
];

function emptyCaps(): Caps {
  return { support: false, moderation: false, captcha: false };
}
function normalizeCaps(raw: unknown): Caps {
  const c = emptyCaps();
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    c.support = Boolean(o.support);
    c.moderation = Boolean(o.moderation);
    c.captcha = Boolean(o.captcha);
  }
  return c;
}
function builtinCaps(key: string): Caps {
  return BUILTIN_ROLES.find((r) => r.key === key)?.caps ?? emptyCaps();
}

type RoleRow = { key: string; title: string; caps: string; builtin: boolean };
type RoleDelegate = {
  findMany: (a?: unknown) => Promise<RoleRow[]>;
  findUnique: (a: { where: { key: string } }) => Promise<RoleRow | null>;
  upsert: (a: { where: { key: string }; create: Record<string, unknown>; update: Record<string, unknown> }) => Promise<RoleRow>;
};
function rdb(): RoleDelegate {
  return (prisma as unknown as { roleDef: RoleDelegate }).roleDef;
}

// Возможности роли. При сбое БД или отсутствии записи — встроенные дефолты (поведение не меняется).
export async function capsForRole(key: string): Promise<Caps> {
  try {
    const row = await rdb().findUnique({ where: { key } });
    if (row?.caps) return normalizeCaps(JSON.parse(row.caps));
  } catch {
    // молча — упадём на встроенные
  }
  return builtinCaps(key);
}

// Полный список ролей: встроенные + пользовательские из БД (БД перекрывает встроенные по ключу).
export async function listRoles(): Promise<Role[]> {
  const map = new Map<string, Role>();
  for (const r of BUILTIN_ROLES) map.set(r.key, r);
  try {
    const rows = await rdb().findMany({ orderBy: { createdAt: "asc" } });
    for (const row of rows) {
      map.set(row.key, { key: row.key, title: row.title, caps: normalizeCaps(JSON.parse(row.caps || "{}")), builtin: row.builtin });
    }
  } catch {
    // БД недоступна — вернём встроенные
  }
  return Array.from(map.values());
}

export async function upsertRole(r: { key: string; title: string; caps: Caps; builtin?: boolean }): Promise<Role | null> {
  const key = r.key.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (!key) return null;
  const caps = JSON.stringify(normalizeCaps(r.caps));
  try {
    const row = await rdb().upsert({
      where: { key },
      create: { key, title: r.title || key, caps, builtin: Boolean(r.builtin), updatedAt: new Date() },
      update: { title: r.title || key, caps, updatedAt: new Date() },
    });
    return { key: row.key, title: row.title, caps: normalizeCaps(JSON.parse(row.caps)), builtin: row.builtin };
  } catch {
    return null;
  }
}

// Создаёт строки для встроенных ролей, если их ещё нет (чтобы их можно было редактировать).
export async function seedRoles(): Promise<void> {
  for (const r of BUILTIN_ROLES) {
    try {
      const row = await rdb().findUnique({ where: { key: r.key } });
      if (!row) await rdb().upsert({ where: { key: r.key }, create: { key: r.key, title: r.title, caps: JSON.stringify(r.caps), builtin: true }, update: {} });
    } catch {
      break;
    }
  }
}
