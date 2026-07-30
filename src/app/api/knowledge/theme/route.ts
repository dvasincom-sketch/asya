import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { complete, hasKey } from "@/lib/timeweb";
import { topicIcon } from "@/lib/topics";
import { getTemplate } from "@/lib/sessionTemplates";

export const runtime = "nodejs";

type FactRow = { id: string; fact: string; topic: string | null; createdAt: Date };
type SessRow = { id: string; template: string; summary: string | null; savedAt: Date | null; createdAt: Date };

function memDb() {
  return prisma.memory as unknown as {
    findMany: (a: {
      where: { userId: string };
      orderBy: { createdAt: "desc" };
      take?: number;
    }) => Promise<FactRow[]>;
  };
}
function sessDb() {
  return (prisma as unknown as {
    coachSession: {
      findMany: (a: {
        where: { userId: string; savedAt: { not: null } };
        orderBy: { createdAt: "desc" };
        take: number;
      }) => Promise<SessRow[]>;
    };
  }).coachSession;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return Response.json({ error: "auth" }, { status: 401 });

  const topic = (req.nextUrl.searchParams.get("topic") || "").trim();
  if (!topic) return Response.json({ error: "bad_request" }, { status: 400 });

  const all = await memDb()
    .findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 300 })
    .catch(() => [] as FactRow[]);
  const facts = all.filter((f) => (f.topic || "Разное") === topic);

  // Разборы этой темы (у шаблона saveTo совпадает с темой).
  const sessions = await sessDb()
    .findMany({ where: { userId: user.id, savedAt: { not: null } }, orderBy: { createdAt: "desc" }, take: 50 })
    .catch(() => [] as SessRow[]);
  const saved = sessions
    .filter((s) => getTemplate(s.template)?.saveTo === topic)
    .map((s) => {
      const t = getTemplate(s.template);
      return {
        id: s.id,
        title: t?.title || s.template,
        icon: t?.icon || "🤍",
        synthType: t?.synthType || "points",
        summary: s.summary || "[]",
        date: s.savedAt || s.createdAt,
      };
    });

  // «Что я понимаю» — короткое обобщение по фактам этой темы.
  let summary = "";
  if (facts.length >= 2 && hasKey()) {
    const sys =
      `Ты — Ася, тёплая подружка. По списку того, что ты знаешь о человеке в теме «${topic}», ` +
      `напиши 2 предложения: что ты понимаешь про него в этой теме. Обращение на «ты», живым языком, ` +
      `без списков и советов. Опирайся только на список, ничего не додумывай. Пиши обычным текстом, без разметки: никаких звёздочек для выделения, решёток, дефисов-списков и таблиц.`;
    summary = (await complete([{ role: "user", content: facts.map((f) => f.fact).join("; ") }], sys, 220)).trim();
  }

  // Моменты — когда что появилось (реальные даты).
  const moments = [
    ...facts.slice(0, 12).map((f) => ({ date: f.createdAt, text: f.fact })),
    ...saved.map((s) => ({ date: s.date, text: `Разбор «${s.title}»` })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 12);

  return Response.json({
    topic,
    icon: topicIcon(topic),
    count: facts.length,
    summary,
    insights: facts.slice(0, 12).map((f) => f.fact),
    saved,
    moments,
  });
}
