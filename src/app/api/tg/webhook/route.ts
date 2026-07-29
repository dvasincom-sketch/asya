import { NextRequest } from "next/server";
import { detectCrisis, type ChatMessage } from "@/lib/crisis";
import { completeChat, hasKey } from "@/lib/timeweb";
import { prisma } from "@/lib/prisma";
import { usageKey, checkAndCount, USER_LIMIT } from "@/lib/ratelimit";
import { rememberFrom } from "@/lib/memory";
import { tgSend, tgTyping, crisisText, TG_WELCOME } from "@/lib/tgbot";

export const runtime = "nodejs";

type TgUpdate = {
  message?: {
    text?: string;
    chat?: { id: number };
    from?: { id: number; first_name?: string; username?: string };
  };
};

// Telegram шлёт сюда апдейты. Отвечаем всегда 200, чтобы он не ретраил без нужды.
export async function POST(req: NextRequest) {
  // Проверка секрета вебхука (если задан при установке).
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return Response.json({ ok: false }, { status: 401 });
  }

  const update = (await req.json().catch(() => null)) as TgUpdate | null;
  const msg = update?.message;
  const chatId = msg?.chat?.id;
  const fromId = msg?.from?.id;
  const text = (msg?.text || "").trim();

  if (!chatId || !fromId) return Response.json({ ok: true });

  // Нетекстовые сообщения — мягко просим текст.
  if (!text) {
    await tgSend(chatId, "Я пока понимаю только текст — напиши мне словами, и я рядом 🤍");
    return Response.json({ ok: true });
  }

  try {
    const tgId = BigInt(fromId);
    const user = await prisma.user.upsert({ where: { tgId }, update: {}, create: { tgId } });

    // /start — тёплое приветствие.
    if (text === "/start") {
      await tgSend(chatId, TG_WELCOME);
      return Response.json({ ok: true });
    }

    const saveHistory = user.historyEnabled;
    const saveMemory = user.memoryEnabled;

    // Кризис — вне лимита, безопасность важнее.
    if (detectCrisis(text)) {
      if (saveHistory) await prisma.message.create({ data: { userId: user.id, role: "user", content: text } }).catch(() => {});
      await prisma.crisisEvent.create({ data: { userId: user.id, level: "keyword" } }).catch(() => {});
      await tgSend(chatId, crisisText());
      return Response.json({ ok: true });
    }

    // Дневной лимит по userId.
    const { allowed } = await checkAndCount(usageKey(req, user.id), USER_LIMIT);
    if (!allowed) {
      await tgSend(chatId, "Мы сегодня хорошо поговорили — я никуда не денусь. Давай продолжим завтра 🤍");
      return Response.json({ ok: true });
    }

    if (!hasKey()) {
      await tgSend(chatId, "Кажется, я сейчас не могу ответить. Попробуй чуть позже 🤍");
      return Response.json({ ok: true });
    }

    // Сохраняем сообщение и собираем контекст из истории.
    if (saveHistory) await prisma.message.create({ data: { userId: user.id, role: "user", content: text } }).catch(() => {});

    const rows = await prisma.message
      .findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20 })
      .catch(() => [] as { role: string; content: string }[]);
    const history: ChatMessage[] = rows
      .map((r: { role: string; content: string }) => ({ role: r.role as "user" | "assistant", content: r.content }))
      .reverse();
    // Если история не сохраняется — работаем хотя бы с текущим сообщением.
    if (!history.length) history.push({ role: "user", content: text });

    // Память в system-prompt.
    let systemExtra = "";
    if (saveMemory) {
      const mems = await prisma.memory
        .findMany({ where: { userId: user.id }, take: 40, orderBy: { createdAt: "desc" } })
        .catch(() => [] as { fact: string }[]);
      if (mems.length) {
        systemExtra =
          "\n\nЧто ты уже знаешь об этом человеке (помни это и обращайся бережно, не перечисляй списком): " +
          mems.map((m: { fact: string }) => m.fact).join("; ");
      }
    }

    await tgTyping(chatId);
    const reply = (await completeChat(history, systemExtra)) || "Прости, я задумалась. Скажешь ещё раз? 🤍";

    await tgSend(chatId, reply);
    if (saveHistory) await prisma.message.create({ data: { userId: user.id, role: "assistant", content: reply } }).catch(() => {});
    if (saveMemory) void rememberFrom(user.id, text);

    return Response.json({ ok: true });
  } catch (e) {
    console.error("[api/tg/webhook] ошибка обработки апдейта:", e);
    // Всё равно 200 — чтобы Telegram не заваливал ретраями.
    return Response.json({ ok: true });
  }
}

// Быстрая проверка, что маршрут жив (Telegram использует только POST).
export async function GET() {
  return Response.json({ ok: true, bot: "asya" });
}
