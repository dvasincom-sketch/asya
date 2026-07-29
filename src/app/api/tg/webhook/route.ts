import { NextRequest } from "next/server";
import { detectCrisis } from "@/lib/crisis";
import { prisma } from "@/lib/prisma";
import { tgSendWebApp, crisisText, safeWebhookSecret } from "@/lib/tgbot";

export const runtime = "nodejs";

type TgUpdate = {
  message?: {
    text?: string;
    chat?: { id: number };
    from?: { id: number };
  };
};

// Опыт Аси в Telegram — это Mini App (наш дизайн). Бот сам не ведёт диалог,
// а мягко открывает приложение. Кризис — единственное исключение: отвечаем сразу.
export async function POST(req: NextRequest) {
  const secret = safeWebhookSecret();
  if (secret && req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return Response.json({ ok: false }, { status: 401 });
  }

  const update = (await req.json().catch(() => null)) as TgUpdate | null;
  const msg = update?.message;
  const chatId = msg?.chat?.id;
  const fromId = msg?.from?.id;
  const text = (msg?.text || "").trim();

  if (!chatId || !fromId) return Response.json({ ok: true });

  const base = process.env.PUBLIC_BASE_URL || req.nextUrl.origin;
  const appUrl = `${base.replace(/\/$/, "")}/chat`;

  try {
    // Заводим пользователя заранее — чтобы Mini App сразу узнал его.
    const tgId = BigInt(fromId);
    const user = await prisma.user.upsert({ where: { tgId }, update: {}, create: { tgId } }).catch(() => null);

    // Кризис — тёплый ответ с контактами прямо в чате, плюс кнопка в приложение.
    if (text && detectCrisis(text)) {
      if (user) await prisma.crisisEvent.create({ data: { userId: user.id, level: "keyword" } }).catch(() => {});
      await tgSendWebApp(chatId, crisisText(), appUrl, "Открыть Асю 🤍");
      return Response.json({ ok: true });
    }

    const greet =
      text === "/start"
        ? "Привет, я Ася 🤍\nЯ живу в уютном приложении — нажми кнопку ниже, и мы поговорим по-настоящему: я буду помнить тебя и всё, что тебе важно."
        : "Давай поговорим в приложении — там теплее и я тебя помню 🤍 Нажми кнопку ниже.";
    await tgSendWebApp(chatId, greet, appUrl);
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[api/tg/webhook] ошибка обработки апдейта:", e);
    return Response.json({ ok: true });
  }
}

// Быстрая проверка, что маршрут жив (Telegram использует только POST).
export async function GET() {
  return Response.json({ ok: true, bot: "asya" });
}
