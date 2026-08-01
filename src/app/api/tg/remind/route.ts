import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { complete, hasKey } from "@/lib/timeweb";
import { clean } from "@/lib/text";
import { tgSendWebApp } from "@/lib/tgbot";

export const runtime = "nodejs";

const DAY = 86400000;

type Cand = { id: string; tgId: bigint | null; reminderCadence: string | null; lastRemindedAt: Date | null };

// Правила частоты, которую человек выбрал сам: сколько дней он должен «отсутствовать»
// и сколько дней должно пройти с прошлого касания.
function rule(cadence: string | null): { idle: number; gap: number } {
  if (cadence === "weekly") return { idle: 1, gap: 7 };
  if (cadence === "often") return { idle: 2, gap: 2 };
  return { idle: 3, gap: 7 }; // rare — по умолчанию, самый бережный
}

// Рассыльщик бережных касаний. Вешается на внешний/Timeweb крон:
//   GET https://<домен>/api/tg/remind?key=<TELEGRAM_WEBHOOK_SECRET>
// Ходить можно хоть раз в час — сам следит за тихими часами, частотой и активностью.
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || key !== secret) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // Тихие часы: пишем только днём по Москве (UTC+3).
  const now = new Date();
  const hourMsk = (now.getUTCHours() + 3) % 24;
  if (hourMsk < 10 || hourMsk >= 21) {
    return Response.json({ ok: true, skipped: "quiet_hours", hourMsk });
  }

  const base = (process.env.PUBLIC_BASE_URL || req.nextUrl.origin).replace(/\/$/, "");

  const userDb = prisma.user as unknown as {
    findMany: (a: {
      where: { remindersEnabled: boolean; tgId: { not: null }; OR: unknown[] };
      select: { id: true; tgId: true; reminderCadence: true; lastRemindedAt: true };
      take: number;
    }) => Promise<Cand[]>;
    update: (a: { where: { id: string }; data: { lastRemindedAt: Date } }) => Promise<unknown>;
  };

  // Кандидаты: касания включены, есть Telegram, с прошлого касания прошло хотя бы 2 дня (самый частый режим).
  const cands = await userDb
    .findMany({
      where: {
        remindersEnabled: true,
        tgId: { not: null },
        OR: [{ lastRemindedAt: null }, { lastRemindedAt: { lt: new Date(now.getTime() - 2 * DAY) } }],
      },
      select: { id: true, tgId: true, reminderCadence: true, lastRemindedAt: true },
      take: 300,
    })
    .catch(() => [] as Cand[]);

  const MAX_SENT = 25; // бережём таймаут: остальные догонит следующий запуск крона
  let sent = 0;

  for (const u of cands) {
    if (sent >= MAX_SENT) break;
    if (!u.tgId) continue;
    const { idle, gap } = rule(u.reminderCadence);

    // С прошлого касания должно пройти достаточно.
    if (u.lastRemindedAt && now.getTime() - new Date(u.lastRemindedAt).getTime() < gap * DAY) continue;

    // Последняя активность: пишем, только если человек «пропал» и уже общался раньше.
    const last = await prisma.message
      .findFirst({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, select: { createdAt: true } })
      .catch(() => null);
    if (!last) continue;
    if (now.getTime() - new Date(last.createdAt).getTime() < idle * DAY) continue;

    // Текст Ася сочиняет с опорой на память (в фактах есть и род обращения).
    let text = "";
    if (hasKey()) {
      const facts = await prisma.memory
        .findMany({ where: { userId: u.id }, take: 30, orderBy: { createdAt: "desc" } })
        .catch(() => [] as { fact: string }[]);
      const mem = facts.map((f: { fact: string }) => f.fact).join("; ");
      const sys =
        "Ты — Ася, тёплая внимательная подружка. Напиши ОДНО короткое сообщение первой, чтобы бережно узнать, как человек. " +
        "1–2 фразы, живым тёплым языком, без списков и разметки, без давления; ничего не продавай и не зови на процедуры. " +
        "Если уместно — мягко вернись к тому, что его волновало. Обращайся в правильном роде, если он известен из фактов.";
      const usr = mem
        ? `Что ты знаешь о человеке: ${mem}. Напиши ему тёплое «как ты?».`
        : "Ты почти не знаешь человека — просто тепло и коротко спроси, как он.";
      text = clean(await complete([{ role: "user", content: usr }], sys, 160)).trim();
    }
    if (!text) text = "Привет 🤍 Просто подумала о тебе — как ты сегодня?";

    await tgSendWebApp(String(u.tgId), text, `${base}/chat`);
    await userDb.update({ where: { id: u.id }, data: { lastRemindedAt: now } }).catch(() => {});
    sent += 1;
  }

  return Response.json({ ok: true, checked: cands.length, sent });
}
