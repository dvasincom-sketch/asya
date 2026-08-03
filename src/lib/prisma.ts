// Единый экземпляр Prisma. К строке подключения добавляем таймауты (если их там ещё нет),
// чтобы при недоступности БД (P1001 на деплое) запросы обрывались быстро и попадали в
// ретраи withDb, а не висли. Параметры добавляем СТРОКОЙ (не через new URL) — чтобы не
// пораниться о спецсимволы в пароле DATABASE_URL.
import { PrismaClient } from "@prisma/client";

function tunedDbUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;
  const extra: string[] = [];
  if (!/[?&]connect_timeout=/.test(url)) extra.push("connect_timeout=10"); // не ждать зависший коннект дольше 10с
  if (!/[?&]pool_timeout=/.test(url)) extra.push("pool_timeout=10"); // ожидание свободного соединения из пула
  if (!extra.length) return url;
  return url + (url.includes("?") ? "&" : "?") + extra.join("&");
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const tuned = tunedDbUrl();
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient(tuned ? { datasources: { db: { url: tuned } } } : undefined);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
