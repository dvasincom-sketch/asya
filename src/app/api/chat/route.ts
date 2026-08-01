import { NextRequest } from "next/server";
import { detectCrisis, CRISIS_REPLY, type ChatMessage } from "@/lib/crisis";
import { streamChat, hasKey } from "@/lib/timeweb";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { usageKey, checkAndCount, ANON_LIMIT, USER_LIMIT } from "@/lib/ratelimit";
import { rememberFrom } from "@/lib/memory";
import { asksAboutServices, buildProgramsContext } from "@/lib/salonKnowledge";
import { SALON } from "@/lib/salon";
import { getSkill, buildSkillContext } from "@/lib/skills";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { messages?: ChatMessage[] } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request", text: "Некорректный запрос." }, { status: 400 });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  const lastUser = [...messages].reverse().find((m) => m.role === "user");

  // Навык, в режиме которого идёт разговор (null = обычная Ася).
  const rawSkill = (body as { skill?: unknown }).skill;
  const skill = getSkill(typeof rawSkill === "string" ? rawSkill : null);
  const skillId = skill?.id ?? null;

  // Текущий пользователь (если вошёл). Для анонимных — быстро вернёт null, без БД.
  const user = await getCurrentUser().catch(() => null);
  const saveHistory = Boolean(user && user.historyEnabled);
  const saveMemory = Boolean(user && user.memoryEnabled);

  // Prisma-клиент в песочнице собран без поля skill — тегируем сообщения через приведение типов.
  const msgDb = prisma.message as unknown as {
    create: (a: { data: { userId: string; role: string; content: string; skill?: string | null } }) => Promise<unknown>;
  };

  // Кризисный путь — модель не вызываем и лимит не применяем (безопасность важнее).
  if (lastUser && detectCrisis(String(lastUser.content))) {
    if (saveHistory && user) {
      await msgDb.create({ data: { userId: user.id, role: "user", content: String(lastUser.content), skill: skillId } }).catch(() => {});
    }
    if (user) await prisma.crisisEvent.create({ data: { userId: user.id, level: "keyword" } }).catch(() => {});
    return Response.json(CRISIS_REPLY);
  }

  // Серверный дневной лимит: аноним — по IP, вошедший — по userId.
  if (lastUser) {
    const key = usageKey(req, user?.id);
    const limit = user ? USER_LIMIT : ANON_LIMIT;
    const { allowed } = await checkAndCount(key, limit);
    if (!allowed) {
      return Response.json(
        {
          error: "limit",
          needAuth: !user,
          text: user
            ? "На сегодня достаточно — я никуда не денусь. Давай продолжим завтра 🤍"
            : "Мы с тобой хорошо поговорили сегодня. Войди — и я сохраню наш разговор, чтобы завтра продолжить с того же места. Это бесплатно.",
        },
        { status: 429 },
      );
    }
  }

  // Сохраняем сообщение пользователя (после лимита — чтобы не копить заблокированные).
  if (saveHistory && user && lastUser) {
    await msgDb.create({ data: { userId: user.id, role: "user", content: String(lastUser.content), skill: skillId } }).catch(() => {});
  }

  if (!hasKey()) {
    return Response.json({ error: "no_key", text: "Ключ модели не задан." }, { status: 503 });
  }

  // Память: что Ася уже знает о человеке — подмешиваем в system-prompt.
  let systemExtra = "";
  if (user && user.memoryEnabled) {
    const mems = await prisma.memory
      .findMany({ where: { userId: user.id }, take: 40, orderBy: { createdAt: "desc" } })
      .catch(() => [] as { fact: string }[]);
    if (mems.length) {
      systemExtra =
        "\n\nЧто ты уже знаешь об этом человеке (помни это и обращайся бережно, не перечисляй списком): " +
        mems.map((m: { fact: string }) => m.fact).join("; ");
    }
  }

  // Спросили про программы салона — подмешиваем справку, чтобы Ася не выдумывала.
  if (SALON.enabled && !skill && lastUser && asksAboutServices(String(lastUser.content))) {
    systemExtra += buildProgramsContext();
  }

  // Навык: подмешиваем грунтовку (метод, границы, справку), чтобы Ася держалась темы и не фантазировала.
  if (skill) systemExtra += buildSkillContext(skill);

  try {
    const upstream = await streamChat(messages, systemExtra);
    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => "");
      console.error(`[api/chat] Модель ответила ошибкой ${upstream.status}: ${detail.slice(0, 800)}`);
      return Response.json(
        { error: "upstream", text: "Не получилось связаться с моделью.", detail: detail.slice(0, 500) },
        { status: 502 },
      );
    }

    // Прокидываем поток в браузер и параллельно копим ответ, чтобы сохранить в историю.
    const reader = upstream.body.getReader();
    const dec = new TextDecoder();
    const uid = user?.id;
    const userText = lastUser ? String(lastUser.content) : "";
    let full = "";
    let buf = "";
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) {
          if (saveHistory && uid && full) {
            await msgDb.create({ data: { userId: uid, role: "assistant", content: full, skill: skillId } }).catch(() => {});
          }
          controller.close();
          // Авто-память: извлекаем факты из реплики пользователя (не блокирует поток).
          if (saveMemory && uid && userText) void rememberFrom(uid, userText);
          return;
        }
        controller.enqueue(value);
        buf += dec.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const evt = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          for (const line of evt.split("\n")) {
            const l = line.trim();
            if (!l.startsWith("data:")) continue;
            const p = l.slice(5).trim();
            if (p === "[DONE]") continue;
            try {
              const j = JSON.parse(p);
              const d = j?.choices?.[0]?.delta?.content;
              if (d) full += d;
            } catch {
              /* неполный фрагмент */
            }
          }
        }
      },
      cancel() {
        reader.cancel().catch(() => {});
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    console.error("[api/chat] Не удалось выполнить запрос к модели:", e);
    return Response.json({ error: "server", text: "Что-то пошло не так на сервере." }, { status: 500 });
  }
}
