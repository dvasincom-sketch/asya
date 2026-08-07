// Гибкие роли бота: роль = именованный набор возможностей (capabilities). Возможностей много, они сгруппированы.
// Безопасно к недоступной БД: при сбое отдаём встроенные дефолты, поведение вебхука не меняется.
import { prisma } from "./prisma";

export type Caps = Record<string, boolean>;
export type Role = { key: string; title: string; caps: Caps; builtin: boolean };
export type CapDef = { key: string; title: string; hint: string; group: string; soon?: boolean };

export const CAP_GROUPS = ["Поддержка", "Новички", "Модерация"];

export const CAP_REGISTRY: CapDef[] = [
  // Поддержка
  { key: "support", title: "Ответы по базе", hint: "Отвечает на вопросы участников по базе знаний и репозиторию", group: "Поддержка" },
  { key: "commands", title: "Команды в чате", hint: "Включает команды: /ask, /rules, /help и свои", group: "Поддержка" },
  { key: "crisis", title: "Кризис-поддержка", hint: "Тепло реагирует на тревожные сообщения (рекомендуется всегда)", group: "Поддержка" },
  // Новички
  { key: "captcha", title: "Капча новичков", hint: "Проверяет новичка по первому сообщению, что он человек", group: "Новички" },
  { key: "welcome", title: "Приветствие новичков", hint: "Тепло встречает нового участника и напоминает про правила", group: "Новички" },
  { key: "casBan", title: "Бан по CAS", hint: "Банит известных спамеров из публичной базы CAS", group: "Новички" },
  { key: "nameFilter", title: "Фильтр имён", hint: "Банит аккаунты с подозрительными именами (спам-паттерны)", group: "Новички" },
  // Модерация
  { key: "delLinks", title: "Удалять ссылки", hint: "Удаляет сообщения со ссылками и рекламой", group: "Модерация" },
  { key: "delHashtags", title: "Удалять хэштеги", hint: "Удаляет сообщения с хэштегами", group: "Модерация" },
  { key: "delLong", title: "Удалять длинные", hint: "Удаляет сообщения длиннее 400 символов", group: "Модерация" },
  { key: "delPlus", title: "Удалять «+»", hint: "Удаляет пустые сообщения из «+» и эмодзи", group: "Модерация" },
  { key: "spamJudge", title: "Ловить спам (ИИ)", hint: "Проверяет подозрительные сообщения моделью и удаляет спам", group: "Модерация" },
  // Планируется (пока не работает) — помечено «скоро».
  { key: "escalation", title: "Эскалация админу", hint: "Если ответа нет в базе — пингует ответственного, а не отвечает в пустоту", group: "Поддержка", soon: true },
  { key: "digestSchedule", title: "Авто-выжимка по расписанию", hint: "Регулярно собирает выжимку из истории чата без ручного нажатия", group: "Поддержка", soon: true },
  { key: "captchaKick", title: "Кик по таймауту капчи", hint: "Удаляет новичка, если он не прошёл проверку за отведённое время", group: "Новички", soon: true },
  { key: "antiflood", title: "Антифлуд", hint: "Ограничивает частоту сообщений от одного участника", group: "Модерация", soon: true },
  { key: "warnSystem", title: "Предупреждения и репутация", hint: "Копит предупреждения нарушителям, мьют/бан по порогу", group: "Модерация", soon: true },
  { key: "nightMode", title: "Ночной режим", hint: "Приглушает или закрывает чат на ночь по расписанию", group: "Модерация", soon: true },
];

const ALL_KEYS = CAP_REGISTRY.map((c) => c.key);

function capsFrom(keys: string[]): Caps {
  const c: Caps = {};
  for (const k of ALL_KEYS) c[k] = keys.includes(k);
  return c;
}
function emptyCaps(): Caps {
  return capsFrom([]);
}
function normalizeCaps(raw: unknown): Caps {
  const c = emptyCaps();
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    for (const k of ALL_KEYS) c[k] = Boolean(o[k]);
  }
  return c;
}

export const BUILTIN_ROLES: Role[] = [
  { key: "off", title: "Выключена", caps: capsFrom([]), builtin: true },
  { key: "support", title: "Поддержка (без модерации)", caps: capsFrom(["support", "commands", "crisis"]), builtin: true },
  { key: "moderation", title: "Модерация", caps: capsFrom(["captcha", "casBan", "nameFilter", "delLinks", "delHashtags", "delLong", "delPlus", "spamJudge", "commands", "crisis"]), builtin: true },
  { key: "both", title: "Модерация + поддержка", caps: capsFrom(["support", "commands", "crisis", "captcha", "welcome", "casBan", "nameFilter", "delLinks", "delHashtags", "delLong", "delPlus", "spamJudge"]), builtin: true },
];

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

// Возможности роли. При сбое БД или отсутствии записи — встроенные дефолты.
export async function capsForRole(key: string): Promise<Caps> {
  try {
    const row = await rdb().findUnique({ where: { key } });
    if (row?.caps) return normalizeCaps(JSON.parse(row.caps));
  } catch {
    // молча — упадём на встроенные
  }
  return builtinCaps(key);
}

export async function listRoles(): Promise<Role[]> {
  const map = new Map<string, Role>();
  for (const r of BUILTIN_ROLES) map.set(r.key, r);
  try {
    const rows = await rdb().findMany({ orderBy: { createdAt: "asc" } });
    for (const row of rows) map.set(row.key, { key: row.key, title: row.title, caps: normalizeCaps(JSON.parse(row.caps || "{}")), builtin: row.builtin });
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

// Возможности из JSON, сохранённого у проекта (чата). null — если не задано.
export function capsFromJson(json?: string | null): Caps | null {
  if (!json) return null;
  try { const p = JSON.parse(json); if (p && typeof p === "object") return normalizeCaps(p); } catch { /* ignore */ }
  return null;
}

// Возможности конкретного проекта: сначала его собственный набор, иначе — по старому ключу роли (совместимость).
export async function capsForChat(cfg: { caps?: string | null; role: string }): Promise<Caps> {
  const own = capsFromJson(cfg.caps);
  if (own) return own;
  return capsForRole(cfg.role);
}

// Есть ли у роли хоть одна включённая возможность.
export function anyCap(caps: Caps): boolean {
  return ALL_KEYS.some((k) => caps[k]);
}
