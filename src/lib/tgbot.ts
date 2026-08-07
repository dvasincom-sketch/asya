// Тонкая обёртка над Telegram Bot API с ретраями (исходящая связь Timeweb→Telegram иногда флапает).
import { CRISIS_REPLY } from "./crisis";

const API = "https://api.telegram.org";

function token(): string {
  return process.env.TELEGRAM_BOT_TOKEN || "";
}

export function safeWebhookSecret(): string {
  return (process.env.TELEGRAM_WEBHOOK_SECRET || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 256);
}

// Единый вызов Telegram API с ретраями и таймаутом. Возвращает распарсенный JSON или null.
async function tgCall(method: string, body: Record<string, unknown>, retries = 3): Promise<Record<string, unknown> | null> {
  const t = token();
  if (!t) return null;
  let last = "";
  for (let i = 0; i < retries; i++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12000);
      const res = await fetch(`${API}/bot${t}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      const j = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (j && j.ok === true) return j;
      // Ответ Telegram с ok:false (напр. нет прав) — ретраить бесполезно.
      if (j && j.ok === false) { last = String(j.description || "ok:false"); break; }
    } catch (e) {
      last = e instanceof Error ? e.message : String(e);
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  if (last) console.warn(`[tg] ${method} не удалось: ${last}`);
  return null;
}

export async function tgSend(chatId: number | string, text: string): Promise<void> {
  await tgCall("sendMessage", { chat_id: chatId, text, disable_web_page_preview: true });
}

export async function tgSendReturningId(chatId: number | string, text: string): Promise<number | null> {
  const j = await tgCall("sendMessage", { chat_id: chatId, text, disable_web_page_preview: true });
  const r = j?.result as { message_id?: number } | undefined;
  return r?.message_id ?? null;
}

export async function tgEdit(chatId: number | string, messageId: number, text: string): Promise<void> {
  if (!text) return;
  await tgCall("editMessageText", { chat_id: chatId, message_id: messageId, text, disable_web_page_preview: true });
}

export async function tgSendWebApp(chatId: number | string, text: string, url: string, btn = "Открыть Асю 🤍"): Promise<void> {
  await tgCall("sendMessage", { chat_id: chatId, text, reply_markup: { inline_keyboard: [[{ text: btn, web_app: { url } }]] } });
}

export async function tgTyping(chatId: number | string): Promise<void> {
  await tgCall("sendChatAction", { chat_id: chatId, action: "typing" });
}

export function crisisText(): string {
  const contacts = CRISIS_REPLY.contacts.map((c) => `• ${c.label}${c.note ? ` — ${c.note}` : ""}`).join("\n");
  return `${CRISIS_REPLY.text}\n\n${contacts}`;
}

export const TG_WELCOME =
  "Привет, я Ася 🤍\nЯ рядом, чтобы выслушать и побыть с тобой — без осуждения и советов свысока.\n\n" +
  "Чтобы говорить по-настоящему, подскажи, как к тебе обращаться — в женском роде или мужском? Спрашиваю только для этого, и это останется между нами.\n\n" +
  "А можно просто начать — расскажи, как ты сегодня?";

// --- Комьюнити-менеджер: модерация в группе (с ретраями) ---

export async function tgDeleteMessage(chatId: number | string, messageId: number): Promise<boolean> {
  const j = await tgCall("deleteMessage", { chat_id: chatId, message_id: messageId });
  return Boolean(j?.ok);
}

export async function tgReply(chatId: number | string, text: string, replyToMessageId?: number): Promise<void> {
  if (!text) return;
  const body: Record<string, unknown> = { chat_id: chatId, text, disable_web_page_preview: true };
  if (replyToMessageId) body.reply_to_message_id = replyToMessageId;
  await tgCall("sendMessage", body);
}

export async function tgIsChatAdmin(chatId: number | string, userId: number | string): Promise<boolean> {
  const j = await tgCall("getChatMember", { chat_id: chatId, user_id: userId });
  const st = (j?.result as { status?: string } | undefined)?.status;
  return st === "administrator" || st === "creator";
}

export async function tgRestrict(chatId: number | string, userId: number | string, canSend: boolean): Promise<void> {
  const perms = canSend
    ? { can_send_messages: true, can_send_audios: true, can_send_documents: true, can_send_photos: true, can_send_videos: true, can_send_video_notes: true, can_send_voice_notes: true, can_send_polls: true, can_send_other_messages: true, can_add_web_page_previews: true }
    : { can_send_messages: false };
  await tgCall("restrictChatMember", { chat_id: chatId, user_id: userId, permissions: perms });
}

export async function tgBan(chatId: number | string, userId: number | string): Promise<void> {
  await tgCall("banChatMember", { chat_id: chatId, user_id: userId });
}

export async function tgSendInline(
  chatId: number | string,
  text: string,
  buttons: { text: string; callback_data: string }[][],
): Promise<number | null> {
  const j = await tgCall("sendMessage", { chat_id: chatId, text, reply_markup: { inline_keyboard: buttons }, disable_web_page_preview: true });
  const r = j?.result as { message_id?: number } | undefined;
  return r?.message_id ?? null;
}

export async function tgAnswerCallback(callbackId: string, text?: string, alert = false): Promise<void> {
  await tgCall("answerCallbackQuery", { callback_query_id: callbackId, text: text || "", show_alert: alert });
}

// Инфо о чате (название и т.п.) — чтобы показывать имена, а не голые id.
export async function tgGetChat(chatId: number | string): Promise<{ title?: string; type?: string } | null> {
  const j = await tgCall("getChat", { chat_id: chatId });
  return (j?.result as { title?: string; type?: string }) ?? null;
}
