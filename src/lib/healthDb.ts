// Доступ к таблицам здоровья. В одном месте, потому что в песочнице Prisma-клиент
// генерируется без новых моделей — в Docker-образе `prisma generate` их создаёт.
import { prisma } from "./prisma";

export type DocRow = {
  id: string;
  userId: string;
  kind: string;
  title: string;
  docDate: Date | null;
  lab: string | null;
  fileName: string | null;
  textRaw?: string | null;
  summary: string | null;
  status: string;
  createdAt: Date;
};

export type MarkerRow = {
  id: string;
  userId: string;
  docId: string;
  code: string;
  name: string;
  value: number | null;
  valueText: string | null;
  unit: string | null;
  refLow: number | null;
  refHigh: number | null;
  refText: string | null;
  flag: string | null;
  takenAt: Date | null;
  createdAt: Date;
};

export type ReminderRow = {
  id: string;
  userId: string;
  title: string;
  dueAt: Date;
  source: string | null;
  note: string | null;
  doneAt: Date | null;
  createdAt: Date;
};

type Where = Record<string, unknown>;

type DocDelegate = {
  create: (a: { data: Record<string, unknown> }) => Promise<DocRow>;
  findMany: (a: { where: Where; orderBy?: Where | Where[]; take?: number; select?: Where }) => Promise<DocRow[]>;
  findFirst: (a: { where: Where }) => Promise<DocRow | null>;
  deleteMany: (a: { where: Where }) => Promise<unknown>;
  count: (a?: { where: Where }) => Promise<number>;
};

type MarkerDelegate = {
  createMany: (a: { data: Record<string, unknown>[] }) => Promise<unknown>;
  findMany: (a: { where: Where; orderBy?: Where | Where[]; take?: number }) => Promise<MarkerRow[]>;
  deleteMany: (a: { where: Where }) => Promise<unknown>;
};

type ReminderDelegate = {
  create: (a: { data: Record<string, unknown> }) => Promise<ReminderRow>;
  createMany: (a: { data: Record<string, unknown>[] }) => Promise<unknown>;
  findMany: (a: { where: Where; orderBy?: Where | Where[]; take?: number }) => Promise<ReminderRow[]>;
  updateMany: (a: { where: Where; data: Where }) => Promise<unknown>;
  deleteMany: (a: { where: Where }) => Promise<unknown>;
};

type UserHealthDelegate = {
  update: (a: { where: { id: string }; data: Where }) => Promise<unknown>;
};

export const healthDb = {
  doc: () => (prisma as unknown as { healthDoc: DocDelegate }).healthDoc,
  marker: () => (prisma as unknown as { healthMarker: MarkerDelegate }).healthMarker,
  reminder: () => (prisma as unknown as { healthReminder: ReminderDelegate }).healthReminder,
  user: () => prisma.user as unknown as UserHealthDelegate,
};

// Пользователь с полями здоровья (в песочнице их нет в типах).
export type HealthUser = {
  id: string;
  healthEnabled?: boolean;
  healthConsentAt?: Date | null;
  healthConsentVer?: string | null;
};
