import { NextRequest } from "next/server";
import { detectCrisis } from "@/lib/crisis";
import { prisma } from "@/lib/prisma";
import {
  tgSendWebApp, crisisText, safeWebhookSecret, tgSend, tgReply, tgDeleteMessage,
  tgIsChatAdmin, tgRestrict, tgBan, tgSendInline, tgAnswerCallback,
} from "@/lib/tgbot";
import { casBanned, suspiciousName, hasLink, judgeSpam, looksLikeQuestion } from "@/lib/antispam";
import { communitySupportReply } from "@/lib/knowledge";
import { getChatConfig, type ChatCfg } from "@/lib/communityConfig";
import { saveMessage } from "@/lib/history";

export const runtime = "nodejs";

type TgUser = { id: number; is_bot?: boolean; first_name?: string; last_name?: string; username?: string | null };
type TgEntity = { type?: string };
type TgMessage = {
  message_id?: number; text?: string; caption?: string;
  chat?: { id: number; type?: string; title?: string }; from?: TgUser;
  entities?: TgEntity[]; caption_entities?: TgEntity[]; new_chat_members?: TgUser[];
};
type TgCallback = { id: string; from?: TgUser; data?: string; message?: { message_id?: number; chat?: { id: number } } };
type TgUpdate = { message?: TgMessage; callback_query?: TgCallback };

function riskySpam(text: string): boolean {
  return /(зарабо|доход|крипт|инвест|ставк|казино|подработ|ваканси|набор |в личку|пишите|@[a-z0-9_]{4,}|http|t\.me|канал|подпис|бесплатн|акци|скидк|прода|телеграм-канал)/i.test(text);
}

// --- Кто уже проверен в чате (капча по первому сообщению) ---
type VmDelegate = {
  findUnique: (a: { where: { chatId_userId: { chatId: string; userId: string } } }) => Promise<{ verified: boolean } | null>;
  upsert: (a: { where: { chatId_userId: { chatId: string; userId: string } }; create: Record<string, unknown>; update: Record<string, unknown> }) => Promise<unknown>;
};
function vmDb(): VmDelegate {
  return (prisma as unknown as { verifiedMember: VmDelegate }).verifiedMember;
}
async function getMember(chatId: number, userId: number): Promise<{ verified: boolean } | null> {
  return vmDb().findUnique({ where: { chatId_userId: { chatId: String(chatId), userId: String(userId) } } }).catch(() => null);
}
async function setMember(chatId: number, userId: number, verified: boolean): Promise<void> {
  await vmDb().upsert({
    where: { chatId_userId: { chatId: String(chatId), userId: String(userId) } },
    create: { chatId: String(chatId), userId: String(userId), verified },
    update: { verified },
  }).catch(() => {});
}

export async function POST(req: NextRequest) {
  const secret = safeWebhookSecret();
  if (secret && req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    console.warn("[cm] secret mismatch — апдейт отклонён");
    return Response.json({ ok: false }, { status: 401 });
  }
  const update = (await req.json().catch(() => null)) as TgUpdate | null;
  if (!update) return Response.json({ ok: true });
  console.log("[cm] incoming:", update.callback_query ? "callback_query" : update.message ? "message" : Object.keys(update).join(","));

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

    if (isGroup) {
      const cfg = await getChatConfig(chatId, msg.chat?.title);
      console.log(`[cm] group chatId=${chatId} role=${cfg?.role} enabled=${cfg?.enabled} from=${msg.from?.id} text=${JSON.stringify((msg.text || msg.caption || "").slice(0, 60))}`);
      if (cfg && cfg.enabled && cfg.role !== "off") await handleCommunity(msg, chatId, cfg);
      return Response.json({ ok: true });
    }

    await handlePrivate(msg, chatId, req);
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[api/tg/webhook] ошибка:", e);
    return Response.json({ ok: true });
  }
}

async function challenge(chatId: number, u: TgUser): Promise<void> {
  await setMember(chatId, u.id, false);
  await tgRestrict(chatId, u.id, false);
  const name = u.first_name || "друг";
  await tgSendInline(
    chatId,
    `${name}, привет 🤍 Похоже, ты у нас впервые. Нажми кнопку, чтобы писать в чат — так я убеждаюсь, что ты человек. Иначе сообщения будут удаляться.`,
    [[{ text: "Я человек 🙌", callback_data: `verify:${u.id}` }]],
  );
}

async function handleCallback(cb: TgCallback): Promise<void> {
  const data = cb.data || "";
  const chatId = cb.message?.chat?.id;
  const msgId = cb.message?.message_id;
  const clicker = cb.from?.id;
  if (data.startsWith("verify:") && chatId && clicker) {
    const target = data.slice("verify:".length);
    if (String(clicker) === target) {
      await setMember(chatId, clicker, true);
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

async function handleCommunity(msg: TgMessage, chatId: number, cfg: ChatCfg): Promise<void> {
  const moderate = cfg.role === "moderation" || cfg.role === "both";

  // Вход новичков — только если включена модерация.
  if (msg.new_chat_members?.length) {
    if (!moderate) return;
    for (const m of msg.new_chat_members) {
      if (m.is_bot) continue;
      if (await casBanned(m.id)) { await tgBan(chatId, m.id); continue; }
      if (suspiciousName(m.first_name, m.last_name, m.username).bad) { await tgBan(chatId, m.id); continue; }
      await challenge(chatId, m);
    }
    return;
  }

  const from = msg.from;
  if (!from || from.is_bot) return;
  const text = (msg.text || msg.caption || "").trim();
  const msgId = msg.message_id;

  // Ася хранит историю чата у себя — чтобы не обращаться к самому чату и уметь делать выжимку.
  if (text) void saveMessage({ chatId, messageId: msgId, userId: from.id, userName: from.first_name || from.username || undefined, text });

  // Кризис — тепло, всегда.
  if (text && detectCrisis(text)) { await tgReply(chatId, crisisText(), msgId); return; }

  const isAdmin = await tgIsChatAdmin(chatId, from.id);

  // --- Модерация (только для роли moderation/both и не для админов) ---
  if (moderate && !isAdmin) {
    const member = await getMember(chatId, from.id);
    if (!member?.verified) {
      if (msgId) await tgDeleteMessage(chatId, msgId);
      if (!member) {
        if (await casBanned(from.id)) { await tgBan(chatId, from.id); return; }
        if (suspiciousName(from.first_name, from.last_name, from.username).bad) { await tgBan(chatId, from.id); return; }
        await challenge(chatId, from);
      }
      return;
    }
    // Ссылки.
    if (hasLink(text, msg.entities, msg.caption_entities)) {
      if (msgId) await tgDeleteMessage(chatId, msgId);
      const name = from.first_name ? `${from.first_name}, ` : "";
      await tgSend(chatId, `${name}тут в чате без ссылок и рекламы 🤍 Если хочешь поделиться чем-то полезным — можно в личку тому, кому интересно.`);
      return;
    }
    // Хэштеги.
    if (/(^|\s)#[^\s#]+/.test(text)) { if (msgId) await tgDeleteMessage(chatId, msgId); return; }
    // Длинные простыни.
    if (text.length > 400) {
      if (msgId) await tgDeleteMessage(chatId, msgId);
      const name = from.first_name ? `${from.first_name}, ` : "";
      await tgSend(chatId, `${name}коротко, пожалуйста 🤍 Сообщения длиннее 400 символов у нас убираются — сформулируй суть в паре строк.`);
      return;
    }
    // «+».
    if (/^[+\s👍➕]+$/.test(text)) { if (msgId) await tgDeleteMessage(chatId, msgId); return; }
    // LLM-спам.
    if (text.length >= 8 && riskySpam(text)) {
      if ((await judgeSpam(text)).spam) { if (msgId) await tgDeleteMessage(chatId, msgId); return; }
    }
  }

  // --- Поддержка/ответы (для support и both; отвечаем и админам) ---
  if (text && looksLikeQuestion(text)) {
    const reply = await communitySupportReply(text, cfg.space, cfg.rules || undefined, cfg.repoUrl || undefined);
    if (reply) await tgReply(chatId, reply, msgId);
  }
}

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
