import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { completeChat, complete, hasKey } from "@/lib/timeweb";
import { getTemplate, templateList, type SessionTemplate } from "@/lib/sessionTemplates";
import type { ChatMessage } from "@/lib/crisis";

export const runtime = "nodejs";

// --- Мягкий доступ к новым моделям Prisma ---------------------------------
// (в песочнице клиент сгенерирован без них; в Docker `prisma generate` их создаёт)
type SessionRow = {
  id: string;
  userId: string;
  template: string;
  step: number;
  done: boolean;
  summary: string | null;
  savedAt: Date | null;
  createdAt: Date;
};
type TurnRow = { id: string; phase: number; role: string; content: string; createdAt: Date };

type SessionDelegate = {
  create: (a: { data: { userId: string; template: string; step?: number } }) => Promise<SessionRow>;
  findFirst: (a: { where: { id: string; userId: string } }) => Promise<SessionRow | null>;
  update: (a: {
    where: { id: string };
    data: Partial<{ step: number; done: boolean; summary: string; savedAt: Date }>;
  }) => Promise<SessionRow>;
  findMany: (a: {
    where: { userId: string; savedAt?: { not: null } };
    orderBy: { createdAt: "desc" };
    take: number;
  }) => Promise<SessionRow[]>;
};
type TurnDelegate = {
  create: (a: { data: { sessionId: string; phase: number; role: string; content: string } }) => Promise<TurnRow>;
  findMany: (a: { where: { sessionId: string }; orderBy: { createdAt: "asc" } }) => Promise<TurnRow[]>;
};

function sessionsDb(): SessionDelegate {
  return (prisma as unknown as { coachSession: SessionDelegate }).coachSession;
}
function turnsDb(): TurnDelegate {
  return (prisma as unknown as { sessionTurn: TurnDelegate }).sessionTurn;
}

// --- Голос Асей внутри сессии --------------------------------------------
// Каркас невидим: Ася отзывается на сказанное и задаёт следующий вопрос своими словами.
function stepInstruction(t: SessionTemplate, question: string, first: boolean): string {
  const intro = first
    ? `Вы начинаете разбор «${t.title}». Тепло, коротко поприветствуй начало разговора`
    : `Вы в разборе «${t.title}». Сначала коротко и тепло отзовись на последний ответ человека (одна-две фразы, отражение чувства, без оценок)`;
  return (
    `\n\nСейчас особый режим: спокойный структурированный разбор. ${intro}, ` +
    `а затем задай ровно один вопрос по смыслу: «${question}». ` +
    `Задай его своими словами, живым языком, как подружка, — не цитируй формулировку буквально и не нумеруй. ` +
    `Никаких списков, заголовков и нескольких вопросов подряд. Не давай советов и не подводи итоги — сейчас только этот один вопрос.`
  );
}

async function turnsToChat(sessionId: string): Promise<ChatMessage[]> {
  const rows = await turnsDb()
    .findMany({ where: { sessionId }, orderBy: { createdAt: "asc" } })
    .catch(() => [] as TurnRow[]);
  return rows.map((r) => ({ role: r.role === "user" ? "user" : "assistant", content: r.content }));
}

// Итог собирается ТОЛЬКО из реальных ответов человека.
async function buildSummary(t: SessionTemplate, turns: ChatMessage[]): Promise<string> {
  const transcript = turns.map((m) => `${m.role === "user" ? "Человек" : "Ася"}: ${m.content}`).join("\n");

  if (t.synthType === "canvas") {
    const keys = (t.canvasKeys || []).join('", "');
    const sys =
      `Ты — аккуратный помощник, который собирает итог разбора «${t.title}» из ответов человека. ` +
      `Верни СТРОГО JSON-массив пар вида [["ключ","значение"], ...] ровно с ключами: "${keys}". ` +
      `Значение — короткая фраза (до 12 слов) на русском, взятая по смыслу из ответов человека, без выдумывания. ` +
      `Если по какому-то ключу человек не сказал ничего — поставь значение "пока не ясно".`;
    const raw = await complete([{ role: "user", content: transcript }], sys, 500);
    const m = raw.match(/\[[\s\S]*\]/);
    return m ? m[0] : "[]";
  }

  const sys =
    `Ты — аккуратный помощник, который собирает итог разбора «${t.title}» из ответов человека. ` +
    `Верни СТРОГО JSON-массив из 3–5 коротких тёплых наблюдений на русском (каждое — одно предложение, обращение на «ты»). ` +
    `Опирайся только на то, что человек действительно сказал: что с ним происходит, что повторяется, что он решил. ` +
    `Не выдумывай деталей и не давай советов свысока.`;
  const raw = await complete([{ role: "user", content: transcript }], sys, 500);
  const m = raw.match(/\[[\s\S]*\]/);
  return m ? m[0] : "[]";
}

// --- GET: шаблоны + сохранённые разборы ----------------------------------
export async function GET() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return Response.json({ user: null, templates: templateList(), saved: [] });

  const rows = await sessionsDb()
    .findMany({ where: { userId: user.id, savedAt: { not: null } }, orderBy: { createdAt: "desc" }, take: 30 })
    .catch(() => [] as SessionRow[]);

  return Response.json({
    user: { id: user.id },
    templates: templateList(),
    saved: rows.map((r) => {
      const t = getTemplate(r.template);
      return {
        id: r.id,
        template: r.template,
        title: t?.title || r.template,
        icon: t?.icon || "🤍",
        saveTo: t?.saveTo || "Разборы",
        synthType: t?.synthType || "points",
        summary: r.summary || "[]",
        createdAt: r.createdAt,
      };
    }),
  });
}

// --- POST: start | reply | finish | save ---------------------------------
export async function POST(req: NextRequest) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return Response.json({ error: "auth", text: "Нужно войти." }, { status: 401 });
  if (!hasKey()) return Response.json({ error: "no_key", text: "Ключ модели не задан." }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");

  try {
    // Начать разбор: создаём сессию и получаем первый вопрос Асей.
    if (action === "start") {
      const t = getTemplate(String(body.template || ""));
      if (!t) return Response.json({ error: "bad_template" }, { status: 400 });

      const s = await sessionsDb().create({ data: { userId: user.id, template: t.id } });
      const question =
        (await completeChat(
          [{ role: "user", content: "Давай сделаем этот разбор вместе." }],
          stepInstruction(t, t.questions[0], true),
        )) || t.questions[0];

      await turnsDb().create({ data: { sessionId: s.id, phase: 0, role: "assistant", content: question } });
      await sessionsDb().update({ where: { id: s.id }, data: { step: 1 } });

      return Response.json({
        sessionId: s.id,
        template: t.id,
        title: t.title,
        topic: t.topic,
        labels: t.labels,
        total: t.questions.length,
        step: 1,
        question,
      });
    }

    const sessionId = String(body.sessionId || "");
    if (!sessionId) return Response.json({ error: "bad_request" }, { status: 400 });
    const s = await sessionsDb().findFirst({ where: { id: sessionId, userId: user.id } });
    if (!s) return Response.json({ error: "not_found" }, { status: 404 });
    const t = getTemplate(s.template);
    if (!t) return Response.json({ error: "bad_template" }, { status: 400 });

    // Ответ человека → следующий вопрос (или сигнал, что пора подводить итог).
    if (action === "reply") {
      const text = String(body.text || "").trim();
      if (!text) return Response.json({ error: "empty" }, { status: 400 });

      const phase = Math.max(0, s.step - 1);
      await turnsDb().create({ data: { sessionId: s.id, phase, role: "user", content: text } });

      // Все вопросы каркаса заданы — дальше итог.
      if (s.step >= t.questions.length) {
        return Response.json({ ready: true, step: s.step, total: t.questions.length });
      }

      const history = await turnsToChat(s.id);
      const question =
        (await completeChat(history, stepInstruction(t, t.questions[s.step], false))) || t.questions[s.step];

      await turnsDb().create({ data: { sessionId: s.id, phase: s.step, role: "assistant", content: question } });
      await sessionsDb().update({ where: { id: s.id }, data: { step: s.step + 1 } });

      return Response.json({ question, step: s.step + 1, total: t.questions.length });
    }

    // Подвести итог — из настоящих ответов.
    if (action === "finish") {
      const history = await turnsToChat(s.id);
      const summary = await buildSummary(t, history);
      await sessionsDb().update({ where: { id: s.id }, data: { done: true, summary } });
      return Response.json({
        summary,
        synthType: t.synthType,
        synthTitle: t.synthTitle,
        synthSub: t.synthSub,
        saveTo: t.saveTo,
      });
    }

    // Сохранить разбор в базу знаний + вынести суть в память Асей.
    if (action === "save") {
      await sessionsDb().update({ where: { id: s.id }, data: { savedAt: new Date() } });

      if (user.memoryEnabled && s.summary) {
        try {
          const parsed: unknown = JSON.parse(s.summary);
          const facts: string[] = Array.isArray(parsed)
            ? parsed
                .map((x) => (Array.isArray(x) ? `${x[0]}: ${x[1]}` : String(x)))
                .filter((x) => x.length > 2)
                .slice(0, 6)
            : [];
          if (facts.length) {
            await prisma.memory.createMany({
              data: facts.map((fact) => ({ userId: user.id, fact: `${t.saveTo} · ${fact}`.slice(0, 300) })),
            });
          }
        } catch {
          /* итог не в JSON — просто не переносим в память */
        }
      }
      return Response.json({ ok: true, saveTo: t.saveTo });
    }

    return Response.json({ error: "bad_action" }, { status: 400 });
  } catch (e) {
    console.error("[api/session] ошибка:", e);
    return Response.json({ error: "server", text: "Что-то пошло не так." }, { status: 500 });
  }
}
