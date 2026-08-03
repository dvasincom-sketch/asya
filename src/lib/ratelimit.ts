// Серверный дневной лимит сообщений. Источник правды — БД (таблица DailyUsage),
// а не localStorage, который легко обойти.
import { prisma } from "./prisma";
import { withDb } from "./db";
import type { NextRequest } from "next/server";

// Лимиты в день.
export const ANON_LIMIT = 20; // аноним: при исчерпании предлагаем войти
export const USER_LIMIT = 100; // вошедший: щедро — чат у нас бесплатный, это лишь защита от abuse

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// Определяем «ключ» посетителя: по userId, иначе по IP из заголовков прокси.
export function usageKey(req: NextRequest, userId?: string | null): string {
  if (userId) return `u:${userId}:${today()}`;
  const fwd = req.headers.get("x-forwarded-for") || "";
  const ip = fwd.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
  return `ip:${ip}:${today()}`;
}

// Мягкий доступ к модели, которой может не быть в локально-сгенерированном клиенте
// (в Docker-образе `prisma generate` создаёт её при сборке).
type UsageDelegate = {
  upsert: (args: {
    where: { key: string };
    create: { key: string; count: number };
    update: { count: { increment: number } };
  }) => Promise<{ count: number }>;
};
function delegate(): UsageDelegate {
  return (prisma as unknown as { dailyUsage: UsageDelegate }).dailyUsage;
}

// Увеличивает счётчик и возвращает, разрешено ли сообщение.
export async function checkAndCount(
  key: string,
  limit: number,
): Promise<{ allowed: boolean; count: number }> {
  // Таймаут + короткий ретрай: зависший upsert не должен морозить отправку сообщения.
  // Если счётчик недоступен даже после ретраев — не блокируем человека (fail-open).
  const row = await withDb(
    () =>
      delegate().upsert({
        where: { key },
        create: { key, count: 1 },
        update: { count: { increment: 1 } },
      }),
    { fallback: null as { count: number } | null, timeoutMs: 2000, retries: 1, label: "ratelimit" },
  );
  if (!row) return { allowed: true, count: 0 };
  return { allowed: row.count <= limit, count: row.count };
}
