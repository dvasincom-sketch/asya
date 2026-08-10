// Внешние проекты, использующие API Аси по ключу. У каждого свой токен и инструкция.
import crypto from "crypto";
import { prisma } from "./prisma";

export type ApiClient = {
  id: string; name: string; token: string; capability: string;
  instruction: string | null; enabled: boolean; calls: number; lastUsedAt: string | null;
};

type Delegate = {
  findMany: (a?: unknown) => Promise<ApiClient[]>;
  findUnique: (a: { where: { token: string } }) => Promise<ApiClient | null>;
  create: (a: { data: Record<string, unknown> }) => Promise<ApiClient>;
  update: (a: { where: { id: string }; data: Record<string, unknown> }) => Promise<ApiClient>;
};
function db(): Delegate {
  return (prisma as unknown as { apiClient: Delegate }).apiClient;
}

export function genToken(): string {
  return "asya_" + crypto.randomBytes(24).toString("base64url");
}

export async function listClients(): Promise<ApiClient[]> {
  return db().findMany({ orderBy: { createdAt: "desc" } }).catch(() => [] as ApiClient[]);
}

export async function createClient(name: string, capability = "summary", instruction?: string): Promise<ApiClient | null> {
  return db().create({ data: { name: name.slice(0, 120) || "Проект", token: genToken(), capability, instruction: instruction || null } }).catch(() => null);
}

export async function updateClient(id: string, data: Partial<Pick<ApiClient, "name" | "instruction" | "enabled" | "capability">>): Promise<ApiClient | null> {
  const clean: Record<string, unknown> = { updatedAt: new Date() };
  for (const k of ["name", "instruction", "enabled", "capability"] as const) if (data[k] !== undefined) clean[k] = data[k];
  return db().update({ where: { id }, data: clean }).catch(() => null);
}

// Найти клиента по токену (только включённого). Для авторизации входящих запросов.
export async function findClientByToken(token: string): Promise<ApiClient | null> {
  if (!token) return null;
  const c = await db().findUnique({ where: { token } }).catch(() => null);
  return c && c.enabled ? c : null;
}

export async function bumpUsage(id: string): Promise<void> {
  await db().update({ where: { id }, data: { calls: { increment: 1 } as unknown as number, lastUsedAt: new Date() } }).catch(() => {});
}
