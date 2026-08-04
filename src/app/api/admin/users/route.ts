import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Метаданные по каждому пользователю + агрегаты оттока. Тексты переписок НЕ отдаём —
// только техметрики (сколько писал, дни активности, навыки, давность). Доступ по ключу.
const DAY = 86400000;

type CoachRow = { userId: string; savedAt: Date | null };
function coachDb() {
  return (prisma as unknown as {
    coachSession: { findMany: (a: { select: { userId: true; savedAt: true } }) => Promise<CoachRow[]> };
  }).coachSession;
}

export async function GET(req: NextRequest) {
  const key = process.env.ADMIN_KEY;
  if (!key) return Response.json({ error: "ADMIN_KEY не задан." }, { status: 503 });
  if (req.nextUrl.searchParams.get("key") !== key) {
    return Response.json({ error: "Неверный ключ." }, { status: 401 });
  }

  const [users, msgs, mems, sessions] = await Promise.all([
    prisma.user
      .findMany({ select: { id: true, tgId: true, phone: true, createdAt: true } })
      .catch(() => [] as { id: string; tgId: bigint | null; phone: string | null; createdAt: Date }[]),
    // Считаем только сообщения человека (role=user) — это его активность, не ответы Аси.
    // Каст: песочный Prisma-клиент отстаёт по полю skill на Message.
    (prisma.message as unknown as {
      findMany: (a: {
        where: { role: string };
        select: { userId: true; createdAt: true; skill: true };
      }) => Promise<{ userId: string; createdAt: Date; skill: string | null }[]>;
    })
      .findMany({ where: { role: "user" }, select: { userId: true, createdAt: true, skill: true } })
      .catch(() => [] as { userId: string; createdAt: Date; skill: string | null }[]),
    prisma.memory.findMany({ select: { userId: true } }).catch(() => [] as { userId: string }[]),
    coachDb().findMany({ select: { userId: true, savedAt: true } }).catch(() => [] as CoachRow[]),
  ]);

  const now = Date.now();
  const dayKey = (d: Date) => new Date(d).toISOString().slice(0, 10);

  // Свёртки по userId.
  type Agg = { count: number; first: number; last: number; days: Set<string>; skills: Set<string> };
  const agg = new Map<string, Agg>();
  for (const m of msgs) {
    let a = agg.get(m.userId);
    if (!a) { a = { count: 0, first: Infinity, last: 0, days: new Set(), skills: new Set() }; agg.set(m.userId, a); }
    const t = new Date(m.createdAt).getTime();
    a.count++;
    a.first = Math.min(a.first, t);
    a.last = Math.max(a.last, t);
    a.days.add(dayKey(m.createdAt));
    if (m.skill) a.skills.add(m.skill);
  }
  const memCount = new Map<string, number>();
  for (const x of mems) memCount.set(x.userId, (memCount.get(x.userId) || 0) + 1);
  const sessStarted = new Map<string, number>();
  const sessSaved = new Map<string, number>();
  for (const s of sessions) {
    sessStarted.set(s.userId, (sessStarted.get(s.userId) || 0) + 1);
    if (s.savedAt) sessSaved.set(s.userId, (sessSaved.get(s.userId) || 0) + 1);
  }

  function statusOf(msgCount: number, last: number): "active" | "at_risk" | "churned" | "dormant" {
    if (msgCount === 0) return "dormant"; // зарегистрировался, но ни разу не написал
    const dsl = Math.floor((now - last) / DAY);
    if (dsl <= 2) return "active";
    if (dsl <= 7) return "at_risk";
    return "churned";
  }

  const rows = users.map((u) => {
    const a = agg.get(u.id);
    const msgCount = a?.count ?? 0;
    const activeDays = a?.days.size ?? 0;
    const last = a?.last ?? 0;
    const first = a && a.first !== Infinity ? a.first : 0;
    const label = u.tgId
      ? `TG …${String(u.tgId).slice(-4)}`
      : u.phone
        ? `тел …${u.phone.slice(-4)}`
        : `id …${u.id.slice(-4)}`;
    return {
      id: u.id.slice(-6),
      uid: u.id, // полный id для загрузки переписки в панели (только под ключом)
      label,
      authVia: u.tgId ? "tg" : u.phone ? "phone" : "—",
      joinedAt: u.createdAt,
      firstMsg: first ? new Date(first).toISOString() : null,
      lastMsg: last ? new Date(last).toISOString() : null,
      daysSinceLast: last ? Math.floor((now - last) / DAY) : null,
      msgs: msgCount,
      activeDays,
      returned: activeDays >= 2,
      skills: [...(a?.skills ?? [])],
      sessions: sessStarted.get(u.id) ?? 0,
      sessionsSaved: sessSaved.get(u.id) ?? 0,
      memories: memCount.get(u.id) ?? 0,
      status: statusOf(msgCount, last),
    };
  });
  // Свежие сверху; кто ни разу не писал — в конец.
  rows.sort((x, y) => (y.lastMsg ? new Date(y.lastMsg).getTime() : 0) - (x.lastMsg ? new Date(x.lastMsg).getTime() : 0));

  const wrote = rows.filter((r) => r.msgs > 0);
  const insights = {
    total: rows.length,
    authedTg: rows.filter((r) => r.authVia === "tg").length,
    authedPhone: rows.filter((r) => r.authVia === "phone").length,
    wrote: wrote.length,
    bounce1msg: wrote.filter((r) => r.msgs === 1).length, // написал один раз и всё
    oneDayOnly: wrote.filter((r) => r.activeDays === 1).length, // приходил лишь в один день
    returned2d: wrote.filter((r) => r.returned).length,
    active: rows.filter((r) => r.status === "active").length,
    atRisk: rows.filter((r) => r.status === "at_risk").length,
    churned: rows.filter((r) => r.status === "churned").length,
    dormant: rows.filter((r) => r.status === "dormant").length,
    retentionRate: wrote.length ? Math.round((wrote.filter((r) => r.returned).length / wrote.length) * 1000) / 10 : 0,
    avgMsgs: wrote.length ? Math.round((wrote.reduce((s, r) => s + r.msgs, 0) / wrote.length) * 10) / 10 : 0,
  };

  return Response.json({ generatedAt: new Date().toISOString(), insights, users: rows });
}
