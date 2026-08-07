// Настройки Аси по чату: авто-регистрация + чтение/запись. Устойчиво к недоступной таблице (логирует, подстраховывает по env).
import { prisma } from "./prisma";

export type ChatCfg = {
  chatId: string; title: string | null; role: string; space: string;
  rules: string | null; repoUrl: string | null; enabled: boolean; commands: string | null; updatedAt?: string;
};

type Delegate = {
  findUnique: (a: { where: { chatId: string } }) => Promise<ChatCfg | null>;
  findMany: (a: unknown) => Promise<ChatCfg[]>;
  create: (a: { data: Record<string, unknown> }) => Promise<ChatCfg>;
  update: (a: { where: { chatId: string }; data: Record<string, unknown> }) => Promise<ChatCfg>;
  upsert: (a: { where: { chatId: string }; create: Record<string, unknown>; update: Record<string, unknown> }) => Promise<ChatCfg>;
};
function db(): Delegate {
  return (prisma as unknown as { chatConfig: Delegate }).chatConfig;
}

function envIds(): string[] {
  return (process.env.COMMUNITY_CHAT_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
}
function synthetic(id: string, title?: string | null): ChatCfg {
  return { chatId: id, title: title ?? null, role: envIds().includes(id) ? "both" : "support", space: "default", rules: null, repoUrl: null, enabled: true, commands: null };
}

// Читает настройку чата; если чата нет — регистрирует. При сбое БД логирует и возвращает подстраховку по env.
export async function getChatConfig(chatId: number | string, title?: string | null): Promise<ChatCfg | null> {
  const id = String(chatId);
  try {
    let row = await db().findUnique({ where: { chatId: id } });
    if (!row) {
      const role = envIds().includes(id) ? "both" : "support";
      row = await db().create({ data: { chatId: id, title: title ?? null, role, enabled: true } });
    } else if (title && row.title !== title) {
      db().update({ where: { chatId: id }, data: { title } }).catch(() => {});
    }
    return row;
  } catch (e) {
    console.error("[chatConfig] getChatConfig:", e instanceof Error ? e.message : String(e));
    return envIds().includes(id) ? synthetic(id, title) : null;
  }
}

export async function listChatConfigs(): Promise<ChatCfg[]> {
  try {
    return await db().findMany({ orderBy: { updatedAt: "desc" }, take: 200 });
  } catch (e) {
    console.error("[chatConfig] list:", e instanceof Error ? e.message : String(e));
    // Подстраховка: показать известные из env чаты, даже если база недоступна (менять их пока нельзя).
    return envIds().map((id) => synthetic(id));
  }
}

export async function updateChatConfig(chatId: string, data: Partial<ChatCfg>): Promise<ChatCfg | null> {
  const id = String(chatId);
  const clean: Record<string, unknown> = { updatedAt: new Date() };
  for (const k of ["title", "role", "space", "rules", "repoUrl", "enabled", "commands"] as const) {
    if (data[k] !== undefined) clean[k] = data[k];
  }
  try {
    return await db().upsert({ where: { chatId: id }, create: { chatId: id, ...clean }, update: clean });
  } catch (e) {
    console.error("[chatConfig] update:", e instanceof Error ? e.message : String(e));
    return null;
  }
}

// Гарантирует наличие строк для известных из env чатов (для панели — увидеть группы сразу).
export async function seedEnvChats(): Promise<{ seeded: string[]; error: string | null }> {
  const ids = envIds();
  let error: string | null = null;
  for (const id of ids) {
    try {
      const row = await db().findUnique({ where: { chatId: id } });
      if (!row) await db().create({ data: { chatId: id, role: "both", enabled: true } });
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }
  return { seeded: ids, error };
}
