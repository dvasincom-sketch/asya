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

type SessionWhere = Record<string, unknown>;
type SessionDelegate = {
  create: (a: { data: { userId: string; template: string; step?: number } }) => Promise<SessionRow>;
  findFirst: (a: { where: SessionWhere; orderBy?: SessionWhere }) => Promise<SessionRow | null>;
  update: (a: {
    where: { id: string };
    data: Partial<{ step: number; done: boolean; summary: string; savedAt: Date }>;
  }) => Promise<SessionRow>;
  updateMany: (a: { where: SessionWhere; data: SessionWhere }) => Promise<unknown>;
  findMany: (a: {
    where: SessionWhere;
    orderBy: SessionWhere;
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

// Активная сессия для восстановления: ходы + вычисленное состояние.
//  await  — ждём ответ человека на последний вопрос (норма);
//  resume — модель не успела задать следующий вопрос (после ошибки) — надо до-генерировать;
//  ready  — все вопросы отвечены, пора подводить итог;
//  done   — итог собран, но ещё не сохранён (вернём к экрану итога).
async function computeActive(userId: string): Promise<Record<string, unknown> | null> {
  const recent = await sessionsDb()
    .findFirst({ where: { userId, savedAt: null }, orderBy: { createdAt: "desc" } })
    .catch(() => null);
  // findFirst у нас без множества — берём последнюю несохранённую; если она заброшена
  // (done без summary), считаем, что активной нет (мы её сами закрыли при старте новой).
  if (!recent) return null;
  if (recent.done && !recent.summary) return null;
  const t = getTemplate(recent.template);
  if (!t) return null;

  const chat = await turnsToChat(recent.id);
  const turns = chat.map((m) => ({ role: m.role, content: m.content }));
  const userCount = turns.filter((x) => x.role === "user").length;
  const asstCount = turns.length - userCount;

  let state: "await" | "resume" | "ready" | "done";
  if (recent.done) state = "done";
  else if (userCount >= t.questions.length) state = "ready";
  else if (asstCount <= userCount) state = "resume"; // нет висящего вопроса после ответа
  else state = "await";

  return {
    sessionId: recent.id,
    template: t.id,
    title: t.title,
    topic: t.topic,
    labels: t.labels,
    total: t.questions.length,
    step: recent.step,
    state,
    turns,
    synth:
      recent.done && recent.summary
        ? { summary: recent.summary, synthType: t.synthType, synthTitle: t.synthTitle, synthSub: t.synthSub, saveTo: t.saveTo }
        : null,
  };
}

// --- GET: шаблоны + сохранённые разборы ----------------------------------
export async function GET() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return Response.json({ user: null, templates: templateList(), saved: [] });

  const rows = await sessionsDb()
    .findMany({ where: { userId: user.id, savedAt: { not: null } }, orderBy: { createdAt: "desc" }, take: 30 })
    .catch(() => [] as SessionRow[]);

  // Активная (незаконченная) сессия — чтобы вернуть человека туда, где он остановился,
  // даже после ошибки модели или перезахода. Прогресс уже в БД (сессия + ходы),
  // раньше он просто нигде не показывался. Берём несколько последних несохранённых и
  // выбираем первую живую: не заброшенную (done без итога — это закрытая нами прежняя).
  const active = await computeActive(user.id);

  return Response.json({
    user: { id: user.id },
    active,
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

      // Закрываем прежние незаконченные разборы этого человека (без итога) — чтобы
      // активной осталась только новая, и восстановление не путалось.
      await sessionsDb()
        .updateMany({ where: { userId: user.id, savedAt: null, done: false }, data: { done: true } })
        .catch(() => {});

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

    // Восстановление зависшего шага: если после ответа человека следующий вопрос
    // не успел задаться (ошибка модели), до-генерируем его — или сообщаем, что пора к итогу.
    if (action === "continue") {
      if (s.done) return Response.json({ done: true });
      const history = await turnsToChat(s.id);
      const userCount = history.filter((m) => m.role === "user").length;
      if (userCount >= t.questions.length) {
        return Response.json({ ready: true, step: s.step, total: t.questions.length });
      }
      const last = history[history.length - 1];
      // Висящего вопроса нет только если последний ход — ответ человека (или пусто).
      if (last && last.role === "assistant") {
        return Response.json({ question: last.content, step: s.step, total: t.questions.length });
      }
      const qIndex = Math.min(userCount, t.questions.length - 1);
      const question =
        (await completeChat(history, stepInstruction(t, t.questions[qIndex], history.length === 0))) || t.questions[qIndex];
      await turnsDb().create({ data: { sessionId: s.id, phase: qIndex, role: "assistant", content: question } });
      await sessionsDb().update({ where: { id: s.id }, data: { step: qIndex + 1 } });
      return Response.json({ question, step: qIndex + 1, total: t.questions.length });
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
            const memDb = prisma.memory as unknown as {
              createMany: (a: { data: { userId: string; fact: string; topic?: string | null }[] }) => Promise<unknown>;
            };
            await memDb.createMany({
              data: facts.map((fact) => ({ userId: user.id, fact: fact.slice(0, 300), topic: t.saveTo })),
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
