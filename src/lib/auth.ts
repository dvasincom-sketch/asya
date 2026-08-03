// Серверные сессии: непрозрачный токен в httpOnly-куке, запись в БД.
import { cookies } from "next/headers";
import crypto from "crypto";
import type { User } from "@prisma/client";
import { prisma } from "./prisma";
import { withDb, isTransient } from "./db";

const COOKIE = "asya_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 дней

export async function createSession(userId: string): Promise<void> {
  const id = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + MAX_AGE * 1000);
  await prisma.session.create({ data: { id, userId, expiresAt } });
  cookies().set(COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

type SessionLite = { expiresAt: Date; user: User } | null;

// Одна попытка прочитать сессию. Транзиентную ошибку БД (недоступность/сеть) пробрасываем,
// чтобы withDb её ретраил, — иначе краткий блип Postgres мгновенно «разлогинивал» человека.
// А вот дрейф схемы (P2022: свежая миграция ещё не догнала прод и include тянет несуществующую
// колонку) не транзиентный — тут же читаем безопасное подмножество полей, чтобы кабинет открывался.
async function loadSession(id: string): Promise<SessionLite> {
  try {
    const s = await prisma.session.findUnique({ where: { id }, include: { user: true } });
    return s as SessionLite;
  } catch (e) {
    if (isTransient(e)) throw e;
    const s = await prisma.session.findUnique({
      where: { id },
      select: {
        expiresAt: true,
        user: {
          select: {
            id: true,
            tgId: true,
            phone: true,
            createdAt: true,
            consentAt: true,
            consentVersion: true,
            memoryEnabled: true,
            historyEnabled: true,
            remindersEnabled: true,
          },
        },
      },
    });
    return s as unknown as SessionLite;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const id = cookies().get(COOKIE)?.value;
  if (!id) return null;
  // Блип БД переживаем ретраями (не роняем сессию); при устойчивой недоступности — null,
  // и вызывающий код (в мини-аппе — AuthGate) мягко переавторизует.
  const session = await withDb(() => loadSession(id), {
    fallback: null as SessionLite,
    timeoutMs: 2500,
    retries: 2,
    label: "auth.session",
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
}

export async function destroySession(): Promise<void> {
  const id = cookies().get(COOKIE)?.value;
  if (id) {
    await prisma.session.delete({ where: { id } }).catch(() => {});
    cookies().delete(COOKIE);
  }
}
