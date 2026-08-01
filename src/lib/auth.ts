// Серверные сессии: непрозрачный токен в httpOnly-куке, запись в БД.
import { cookies } from "next/headers";
import crypto from "crypto";
import type { User } from "@prisma/client";
import { prisma } from "./prisma";

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

export async function getCurrentUser(): Promise<User | null> {
  const id = cookies().get(COOKIE)?.value;
  if (!id) return null;
  const alive = (expiresAt: Date) => expiresAt >= new Date();
  try {
    const session = await prisma.session.findUnique({ where: { id }, include: { user: true } });
    if (!session || !alive(session.expiresAt)) return null;
    return session.user;
  } catch {
    // Схема БД могла отстать от Prisma-клиента: свежая миграция ещё не применилась на проде,
    // и include: { user: true } тянет колонки, которых в базе пока нет (Prisma P2022).
    // Берём только базовые поля, которые есть всегда, — чтобы кабинет открывался, пока
    // миграции догоняют. Недостающие поля (portrait, healthEnabled и т.п.) будут undefined
    // и обрабатываются вызывающим кодом как «пусто/выключено».
    try {
      const session = await prisma.session.findUnique({
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
      if (!session || !alive(session.expiresAt)) return null;
      return session.user as unknown as User;
    } catch {
      return null;
    }
  }
}

export async function destroySession(): Promise<void> {
  const id = cookies().get(COOKIE)?.value;
  if (id) {
    await prisma.session.delete({ where: { id } }).catch(() => {});
    cookies().delete(COOKIE);
  }
}
