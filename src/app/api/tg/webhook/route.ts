import { NextRequest } from "next/server";
import { detectCrisis } from "@/lib/crisis";
import { prisma } from "@/lib/prisma";
import {
  tgSendWebApp, crisisText, safeWebhookSecret, tgSend, tgReply, tgDeleteMessage,
  tgIsChatAdmin, tgRestrict, tgBan, tgSendInline, tgAnswerCallback,
} from "@/lib/tgbot";
import { casBanned, suspiciousName, hasLink, judgeSpam, communityReply, looksLikeQuestion } from "@/lib/antispam";

export const runtime = "nodejs";

type TgUser = { id: number; is_bot?: boolean; first_name?: string; last_name?: string; username?: string | null };
type TgEntity = { type?: string };
type TgMessage = {
  message_id?: number; text?: string; caption?: string;
  chat?: { id: number; type?: string }; from?: TgUser;
  entities?: TgEntity[]; caption_entities?: TgEntity[]; new_chat_members?: TgUser[];
};
type TgCallback = { id: string; from?: TgUser; data?: string; message?: { message_id?: number; chat?: { id: number } } };
type TgUpdate = { message?: TgMessage; callback_query?: TgCallback };

function communityIds(): string[] {
  return (process.env.COMMUNITY_CHAT_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
}

// Признаки рекламного спама без ссылки — чтобы звать LLM-оценку только по риску, а не на каждое сообщение.
function riskySpam(text: string): boolean {
  return /(зарабо|доход|крипт|инвест|ставк|казино|подработ|ваканси|набор |в личку|пишите|@[a-z0-9_]{4,}|http|t\.me|канал|подпис|бесплатн|акци|скидк|прода|телеграм-канал)/i.test(text);
}

export async function POST(req: NextRequest) {
  const secret = safeWebhookSecret();
  if (secret && req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return Response.json({ ok: false }, { status: 401 });
  }
  const update = (await req.json().catch(() => null)) as TgUpdate | null;
  if (!update) return Response.json({ ok: true });

  try {
    if (update.callback_query) {
      await handleCallback(update.callback_query);
      return Response.json({ ok: true });
    }
    const msg = update.message;
    const chatId = msg?.chat?.id;
    if (!msg || !chatId) return Response.json({ ok: true });

    const chatType = msg.chat?.type;
    const isGroup = chatType === "group" || chatType === "supergroup";

    if (isGroup && communityIds().includes(String(chatId))) {
      await handleCommunity(msg, chatId);
      return Response.json({ ok: true });
    }
    if (isGroup) return Response.json({ ok: true }); // чужие/ненастроенные группы — молчим

    await handlePrivate(msg, chatId, req);
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[api/tg/webhook] ошибка:", e);
    return Response.json({ ok: true });
  }
}

// Капча «Я человек».
async function handleCallback(cb: TgCallback): Promise<void> {
  const data = cb.data || "";
  const chatId = cb.message?.chat?.id;
  const msgId = cb.message?.message_id;
  const clicker = cb.from?.id;
  if (data.startsWith("verify:") && chatId && clicker) {
    const target = data.slice("verify:".length);
    if (String(clicker) === target) {
      await tgRestrict(chatId, clicker, true);
      await tgAnswerCallback(cb.id, "Готово, добро пожаловать 🤍");
      if (msgId) await tgDeleteMessage(chatId, msgId);
    } else {
      await tgAnswerCallback(cb.id, "Это проверка не для тебя 🙂", true);
    }
    return;
  }
  await tgAnswerCallback(cb.id);
}

// Комьюнити-менеджер в группе сообщества.
async function handleCommunity(msg: TgMessage, chatId: number): Promise<void> {
  // Входной фильтр новичков.
  if (msg.new_chat_members?.length) {
    for (const m of msg.new_chat_members) {
      if (m.is_bot) continue;
      if (await casBanned(m.id)) { await tgBan(chatId, m.id); continue; }
      if (suspiciousName(m.first_name, m.last_name, m.username).bad) { await tgBan(chatId, m.id); continue; }
      await tgRestrict(chatId, m.id, false);
      const name = m.first_name || "друг";
      await tgSendInline(
        chatId,
        `${name}, добро пожаловать 🤍 Чтобы писать в чат, нажми кнопку — так я убеждаюсь, что ты человек.`,
        [[{ text: "Я человек 🙌", callback_data: `verify:${m.id}` }]],
      );
    }
    return;
  }

  const from = msg.from;
  if (!from || from.is_bot) return;
  const text = (msg.text || msg.caption || "").trim();
  const msgId = msg.message_id;

  // Кризис — тёпло, даже в группе.
  if (text && detectCrisis(text)) {
    await tgReply(chatId, crisisText(), msgId);
    return;
  }

  // Админов не модерируем.
  if (await tgIsChatAdmin(chatId, from.id)) return;

  // Ссылки — удаляем + тёпло объясняем.
  if (hasLink(text, msg.entities, msg.caption_entities)) {
    if (msgId) await tgDeleteMessage(chatId, msgId);
    const name = from.first_name ? `${from.first_name}, ` : "";
    await tgSend(chatId, `${name}тут в чате без ссылок и рекламы 🤍 Если хочешь поделиться чем-то полезным — можно в личку тому, кому интересно.`);
    return;
  }

  // LLM-оценка спама (только по риску).
  if (text.length >= 8 && riskySpam(text)) {
    if ((await judgeSpam(text)).spam) {
      if (msgId) await tgDeleteMessage(chatId, msgId);
      return;
    }
  }

  // Контекстный тёплый ответ (только если похоже на вопрос/обращение).
  if (text && looksLikeQuestion(text)) {
    const reply = await communityReply(text);
    if (reply) await tgReply(chatId, reply, msgId);
  }
}

// Личка — прежнее поведение: Mini App, кризис отдельно.
async function handlePrivate(msg: TgMessage, chatId: number, req: NextRequest): Promise<void> {
  const fromId = msg.from?.id;
  const text = (msg.text || "").trim();
  if (!fromId) return;

  const base = process.env.PUBLIC_BASE_URL || req.nextUrl.origin;
  const appUrl = `${base.replace(/\/$/, "")}/chat`;

  const tgId = BigInt(fromId);
  const user = await prisma.user.upsert({ where: { tgId }, update: { archivedAt: null } as never, create: { tgId } }).catch(() => null);

  if (text && detectCrisis(text)) {
    if (user) await prisma.crisisEvent.create({ data: { userId: user.id, level: "keyword" } }).catch(() => {});
    await tgSendWebApp(chatId, crisisText(), appUrl, "Открыть Асю 🤍");
    return;
  }

  const greet =
    text === "/start"
      ? "Привет, я Ася 🤍\nЯ живу в уютном приложении — нажми кнопку ниже, и мы поговорим по-настоящему: я буду помнить тебя и всё, что тебе важно."
      : "Давай поговорим в приложении — там теплее и я тебя помню 🤍 Нажми кнопку ниже.";
  await tgSendWebApp(chatId, greet, appUrl);
}

export async function GET() {
  return Response.json({ ok: true, bot: "asya" });
}
