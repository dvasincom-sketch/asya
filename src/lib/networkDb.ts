// Типизированные обёртки к моделям сети (Prisma-клиент в песочнице без них).
// Каст на уровне prisma (а не после .offer), иначе стейл-клиент падает на доступе к свойству.
import { prisma } from "./prisma";

export type OfferRow = { id: string; userId: string; category: string; title: string; params: string | null; blurb: string | null; shareScope: string | null; status: string; createdAt: Date; updatedAt: Date };
export type RequestRow = { id: string; userId: string; category: string; criteria: string | null; note: string | null; status: string; deadline: Date | null; createdAt: Date };
export type IntroRow = { id: string; requestId: string; offerId: string; candidateId: string; requesterId: string; status: string; candidateOk: boolean; requesterOk: boolean; createdAt: Date };
export type ConsentRow = { id: string; userId: string; category: string; enabled: boolean };

type Where = Record<string, unknown>;

export function offersDb() {
  return (prisma as unknown as {
    offer: {
      findMany: (a: { where: Where; orderBy?: Where; take?: number }) => Promise<OfferRow[]>;
      findUnique: (a: { where: { id: string } }) => Promise<OfferRow | null>;
      create: (a: { data: Where }) => Promise<OfferRow>;
      update: (a: { where: { id: string }; data: Where }) => Promise<OfferRow>;
      delete: (a: { where: { id: string } }) => Promise<unknown>;
    };
  }).offer;
}
export function requestsDb() {
  return (prisma as unknown as {
    requestPost: {
      findMany: (a: { where: Where; orderBy?: Where; take?: number }) => Promise<RequestRow[]>;
      findUnique: (a: { where: { id: string } }) => Promise<RequestRow | null>;
      create: (a: { data: Where }) => Promise<RequestRow>;
      update: (a: { where: { id: string }; data: Where }) => Promise<unknown>;
      delete: (a: { where: { id: string } }) => Promise<unknown>;
    };
  }).requestPost;
}
export function introsDb() {
  return (prisma as unknown as {
    intro: {
      findMany: (a: { where: Where; orderBy?: Where; take?: number }) => Promise<IntroRow[]>;
      findUnique: (a: { where: { id: string } }) => Promise<IntroRow | null>;
      create: (a: { data: Where }) => Promise<IntroRow>;
      update: (a: { where: { id: string }; data: Where }) => Promise<IntroRow>;
    };
  }).intro;
}
export function consentDb() {
  return (prisma as unknown as {
    networkConsent: {
      findMany: (a: { where: Where }) => Promise<ConsentRow[]>;
      upsert: (a: { where: { userId_category: { userId: string; category: string } }; create: Where; update: Where }) => Promise<ConsentRow>;
    };
  }).networkConsent;
}
export function blockDb() {
  return (prisma as unknown as {
    block: {
      findMany: (a: { where: Where }) => Promise<{ userId: string; blockedId: string }[]>;
      upsert: (a: { where: { userId_blockedId: { userId: string; blockedId: string } }; create: Where; update: Where }) => Promise<unknown>;
    };
  }).block;
}
export function reportDb() {
  return (prisma as unknown as {
    report: {
      create: (a: { data: Where }) => Promise<unknown>;
    };
  }).report;
}

export type RoomRow = { id: string; introId: string; status: string; asyaPresent: boolean; createdAt: Date; updatedAt: Date };
export type RoomMemberRow = { id: string; roomId: string; userId: string; removeAsya: boolean; lastReadAt: Date };
export type RoomMessageRow = { id: string; roomId: string; sender: string; senderId: string | null; kind: string; content: string; createdAt: Date };

export function roomDb() {
  return (prisma as unknown as {
    room: {
      findUnique: (a: { where: { id?: string; introId?: string } }) => Promise<RoomRow | null>;
      findMany: (a: { where: Where; orderBy?: Where; take?: number }) => Promise<RoomRow[]>;
      create: (a: { data: Where }) => Promise<RoomRow>;
      update: (a: { where: { id: string }; data: Where }) => Promise<RoomRow>;
    };
  }).room;
}
export function roomMemberDb() {
  return (prisma as unknown as {
    roomMember: {
      findMany: (a: { where: Where; orderBy?: Where; take?: number }) => Promise<RoomMemberRow[]>;
      findUnique: (a: { where: { roomId_userId: { roomId: string; userId: string } } }) => Promise<RoomMemberRow | null>;
      create: (a: { data: Where }) => Promise<RoomMemberRow>;
      update: (a: { where: { roomId_userId: { roomId: string; userId: string } }; data: Where }) => Promise<RoomMemberRow>;
      updateMany: (a: { where: Where; data: Where }) => Promise<unknown>;
    };
  }).roomMember;
}
export function roomMsgDb() {
  return (prisma as unknown as {
    roomMessage: {
      findMany: (a: { where: Where; orderBy?: Where; take?: number }) => Promise<RoomMessageRow[]>;
      create: (a: { data: Where }) => Promise<RoomMessageRow>;
      count: (a: { where: Where }) => Promise<number>;
    };
  }).roomMessage;
}

// Контакт человека для передачи после взаимного согласия.
export async function userContact(userId: string): Promise<{ phone: string | null; tgId: string | null } | null> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true, tgId: true } }).catch(() => null);
  if (!u) return null;
  return { phone: u.phone ?? null, tgId: u.tgId ? String(u.tgId) : null };
}
export async function userTgId(userId: string): Promise<string | null> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { tgId: true } }).catch(() => null);
  return u?.tgId ? String(u.tgId) : null;
}
