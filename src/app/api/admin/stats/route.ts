import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type Row = { name: string; anonId: string | null; userId: string | null; ts: Date };

function eventDb() {
  return (prisma as unknown as {
    event: { findMany: (a: { where: { ts: { gte: Date } } }) => Promise<Row[]> };
  }).event;
}

// Воронка и удержание за N дней. Доступ по ключу: /api/admin/stats?key=<ADMIN_KEY>&days=7
export async function GET(req: NextRequest) {
  const key = process.env.ADMIN_KEY;
  if (!key) return Response.json({ error: "ADMIN_KEY не задан." }, { status: 503 });
  if (req.nextUrl.searchParams.get("key") !== key) {
    return Response.json({ error: "Неверный ключ." }, { status: 401 });
  }

  const days = Math.min(90, Math.max(1, Number(req.nextUrl.searchParams.get("days") || 7)));
  const since = new Date(Date.now() - days * 86400000);

  const events = await eventDb().findMany({ where: { ts: { gte: since } } }).catch(() => [] as Row[]);

  // Уникальные посетители по событию (по обезличенному id, иначе по пользователю).
  const uniq = (name: string) => {
    const s = new Set<string>();
    for (const e of events) {
      if (e.name !== name) continue;
      const id = e.anonId || e.userId;
      if (id) s.add(id);
    }
    return s;
  };

  const landing = uniq("landing_view");
  const chat = uniq("chat_open");
  const first = uniq("first_message");
  const gate = uniq("gate_shown");
  const logins = uniq("login_done");
  const consents = uniq("consent_given");
  const sessStart = uniq("session_start");
  const sessSaved = uniq("session_saved");
  const miniapp = uniq("miniapp_open");

  // Возвраты: сколько людей писали сообщения в 2+ разных дня.
  const byPerson = new Map<string, Set<string>>();
  for (const e of events) {
    if (e.name !== "message_sent") continue;
    const id = e.anonId || e.userId;
    if (!id) continue;
    const day = new Date(e.ts).toISOString().slice(0, 10);
    if (!byPerson.has(id)) byPerson.set(id, new Set());
    byPerson.get(id)!.add(day);
  }
  const returned = [...byPerson.values()].filter((d) => d.size >= 2).length;

  const [users, messages, memories, crisisEvents, subs] = await Promise.all([
    prisma.user.count().catch(() => 0),
    prisma.message.count().catch(() => 0),
    prisma.memory.count().catch(() => 0),
    prisma.crisisEvent.count().catch(() => 0),
    prisma.subscription.count().catch(() => 0),
  ]);

  // Дневной ряд активности за период: сообщений и уникальных активных людей по дням.
  const msgByDay = new Map<string, number>();
  const usersByDay = new Map<string, Set<string>>();
  for (const e of events) {
    if (e.name !== "message_sent") continue;
    const day = new Date(e.ts).toISOString().slice(0, 10);
    msgByDay.set(day, (msgByDay.get(day) || 0) + 1);
    const id = e.anonId || e.userId;
    if (id) {
      if (!usersByDay.has(day)) usersByDay.set(day, new Set());
      usersByDay.get(day)!.add(id);
    }
  }
  const daily: { day: string; messages: number; users: number }[] = [];
  const cur = new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth(), since.getUTCDate()));
  const nowMs = Date.now();
  while (cur.getTime() <= nowMs) {
    const day = cur.toISOString().slice(0, 10);
    daily.push({ day, messages: msgByDay.get(day) || 0, users: usersByDay.get(day)?.size || 0 });
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);

  return Response.json({
    period: { days, since },
    funnel: {
      landing: landing.size,
      chatOpened: chat.size,
      firstMessage: first.size,
      loggedIn: logins.size,
      consentGiven: consents.size,
      gateShown: gate.size,
      miniappOpened: miniapp.size,
    },
    conversion: {
      landingToChat: pct(chat.size, landing.size),
      chatToFirstMessage: pct(first.size, chat.size),
      firstMessageToLogin: pct(logins.size, first.size),
      gateToLogin: pct(logins.size, gate.size),
    },
    retention: { peopleWithMessages: byPerson.size, returnedAnotherDay: returned, rate: pct(returned, byPerson.size) },
    sessions: { started: sessStart.size, saved: sessSaved.size },
    daily,
    totals: { users, messages, memories, crisisEvents, subscriptions: subs },
  });
}
