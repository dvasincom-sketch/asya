// «Забота+»: подписка через YooKassa. Модель — платим за хранение: бесплатно память и
// история живут ограниченный срок, в Забота+ — бессрочно и полностью.
import crypto from "crypto";
import { prisma } from "./prisma";

const YOO_API = "https://api.yookassa.ru/v3/payments";
export const PLUS_AMOUNT = process.env.PLUS_AMOUNT || "300.00"; // рублей
export const FREE_RETENTION_DAYS = Number(process.env.FREE_RETENTION_DAYS || 14);

export type Sub = {
  id: string;
  userId: string;
  status: string; // pending | active | canceled | past_due
  provider: string;
  externalId: string | null; // сохранённый способ оплаты (payment_method_id)
  nextChargeAt: Date | null;
};

// Настроена ли оплата. Пока нет ключей — оплату не предлагаем и лимит хранения НЕ включаем.
export function plusConfigured(): boolean {
  return Boolean(process.env.YOOKASSA_SHOP_ID && process.env.YOOKASSA_SECRET_KEY);
}

function subDb() {
  return prisma.subscription as unknown as {
    findUnique: (a: { where: { userId: string } }) => Promise<Sub | null>;
    findMany: (a: { where: Record<string, unknown>; take: number }) => Promise<Sub[]>;
    upsert: (a: {
      where: { userId: string };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }) => Promise<Sub>;
    update: (a: { where: { userId: string }; data: Record<string, unknown> }) => Promise<Sub>;
  };
}

export function getSub(userId: string): Promise<Sub | null> {
  return subDb()
    .findUnique({ where: { userId } })
    .catch(() => null);
}

// До какого момента действует доступ Забота+ (или null).
export function plusUntil(sub: Sub | null): Date | null {
  if (!sub) return null;
  const nca = sub.nextChargeAt ? new Date(sub.nextChargeAt) : null;
  if (sub.status === "active") return nca ?? new Date(8.64e15);
  if (sub.status === "canceled" && nca) return nca; // доступ до конца оплаченного периода
  return null;
}

export function hasPlus(sub: Sub | null): boolean {
  const u = plusUntil(sub);
  return Boolean(u && u.getTime() > Date.now());
}

// С какой даты показываем/используем данные бесплатному пользователю (null = без лимита).
// Лимит включается ТОЛЬКО когда оплата настроена — иначе до запуска платежей ничего не режем.
export function retentionSince(sub: Sub | null): Date | null {
  if (!plusConfigured()) return null;
  if (hasPlus(sub)) return null;
  return new Date(Date.now() - FREE_RETENTION_DAYS * 86400000);
}

// --- YooKassa ---------------------------------------------------------------
function authHeader(): string {
  const id = process.env.YOOKASSA_SHOP_ID || "";
  const key = process.env.YOOKASSA_SECRET_KEY || "";
  return "Basic " + Buffer.from(`${id}:${key}`).toString("base64");
}

type YooPayment = {
  id: string;
  status: string; // pending | waiting_for_capture | succeeded | canceled
  paid?: boolean;
  confirmation?: { confirmation_url?: string };
  payment_method?: { id?: string; saved?: boolean };
  metadata?: { userId?: string };
};

async function yooPost(body: Record<string, unknown>): Promise<YooPayment | null> {
  try {
    const res = await fetch(YOO_API, {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
        "Idempotence-Key": crypto.randomUUID(),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error(`[plus] YooKassa ${res.status}: ${(await res.text().catch(() => "")).slice(0, 400)}`);
      return null;
    }
    return (await res.json()) as YooPayment;
  } catch (e) {
    console.error("[plus] YooKassa запрос не удался:", e);
    return null;
  }
}

// Первый платёж с сохранением карты — вернёт ссылку на оплату.
export function yooCreateCheckout(userId: string, returnUrl: string): Promise<YooPayment | null> {
  return yooPost({
    amount: { value: PLUS_AMOUNT, currency: "RUB" },
    capture: true,
    save_payment_method: true,
    confirmation: { type: "redirect", return_url: returnUrl },
    description: "Забота+ — подписка на месяц",
    metadata: { userId },
  });
}

// Продление: автосписание по сохранённой карте (без участия человека).
export function yooChargeSaved(userId: string, methodId: string): Promise<YooPayment | null> {
  return yooPost({
    amount: { value: PLUS_AMOUNT, currency: "RUB" },
    capture: true,
    payment_method_id: methodId,
    description: "Забота+ — продление подписки",
    metadata: { userId },
  });
}

// Проверить платёж по id (для вебхука — не доверяем телу, а перезапрашиваем у YooKassa).
export async function yooGetPayment(id: string): Promise<YooPayment | null> {
  try {
    const res = await fetch(`${YOO_API}/${encodeURIComponent(id)}`, { headers: { Authorization: authHeader() } });
    if (!res.ok) return null;
    return (await res.json()) as YooPayment;
  } catch {
    return null;
  }
}

export function addMonth(from: Date): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() + 1);
  return d;
}

// Записать активную подписку после успешной оплаты.
export async function activateSub(userId: string, methodId: string | null): Promise<void> {
  const next = addMonth(new Date());
  await subDb()
    .upsert({
      where: { userId },
      create: { userId, status: "active", provider: "yookassa", externalId: methodId, nextChargeAt: next },
      update: { status: "active", externalId: methodId ?? undefined, nextChargeAt: next },
    })
    .catch(() => {});
}

export async function markPending(userId: string): Promise<void> {
  await subDb()
    .upsert({
      where: { userId },
      create: { userId, status: "pending", provider: "yookassa" },
      update: { status: "pending" },
    })
    .catch(() => {});
}

export async function cancelSub(userId: string): Promise<void> {
  await subDb().update({ where: { userId }, data: { status: "canceled" } }).catch(() => {});
}

// Подписки, которым пора списывать продление.
export function dueSubs(now: Date, take = 100): Promise<Sub[]> {
  return subDb()
    .findMany({ where: { status: "active", nextChargeAt: { lte: now }, externalId: { not: null } }, take })
    .catch(() => [] as Sub[]);
}

export async function extendSub(userId: string): Promise<void> {
  await subDb().update({ where: { userId }, data: { status: "active", nextChargeAt: addMonth(new Date()) } }).catch(() => {});
}

export async function markPastDue(userId: string): Promise<void> {
  await subDb().update({ where: { userId }, data: { status: "past_due" } }).catch(() => {});
}
