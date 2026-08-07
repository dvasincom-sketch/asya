// Настройки Аси по чату: авто-регистрация чатов, где бот получает сообщения, + чтение/запись.
import { prisma } from "./prisma";

export type ChatCfg = {
  chatId: string; title: string | null; role: string; space: string;
  rules: string | null; repoUrl: string | null; enabled: boolean; updatedAt?: string;
};

type Delegate = {
  findUnique: (a: { where: { chatId: string } }) => Promise<ChatCfg | null>;
  findMany: (a: unknown) => Promise<ChatCfg[]>;
  create: (a: { data: Record<string, unknown> }) => Promise<ChatCfg>;
  update: (a: { where: { chatId: string }; data: Record<string, unknown> }) => Promise<ChatCfg>;
};
function db(): Delegate {
  return (prisma as unknown as { chatConfig: Delegate }).chatConfig;
}

// Читает настройку чата; если чата ещё нет — регистрирует (чтобы появился в админке).
export async function getChatConfig(chatId: number | string, title?: string | null): Promise<ChatCfg | null> {
  const id = String(chatId);
  let row = await db().findUnique({ where: { chatId: id } }).catch(() => null);
  if (!row) {
    const envIds = (process.env.COMMUNITY_CHAT_IDS || "").split(",").map((s) => s.trim());
    const role = envIds.includes(id) ? "both" : "support"; // ранее настроенные чаты сохраняют модерацию
    row = await db().create({ data: { chatId: id, title: title ?? null, role, enabled: true } }).catch(() => null);
  } else if (title && row.title !== title) {
    db().update({ where: { chatId: id }, data: { title } }).catch(() => {});
  }
  return row;
}

export async function listChatConfigs(): Promise<ChatCfg[]> {
  return db().findMany({ orderBy: { updatedAt: "desc" }, take: 200 }).catch(() => [] as ChatCfg[]);
}

export async function updateChatConfig(chatId: string, data: Partial<ChatCfg>): Promise<ChatCfg | null> {
  const clean: Record<string, unknown> = { updatedAt: new Date() };
  for (const k of ["title", "role", "space", "rules", "repoUrl", "enabled"] as const) {
    if (data[k] !== undefined) clean[k] = data[k];
  }
  return db().update({ where: { chatId: String(chatId) }, data: clean }).catch(() => null);
}
