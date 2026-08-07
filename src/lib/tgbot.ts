// Тонкая обёртка над Telegram Bot API.
import { CRISIS_REPLY } from "./crisis";

const API = "https://api.telegram.org";

function token(): string {
  return process.env.TELEGRAM_BOT_TOKEN || "";
}

// Telegram разрешает в secret_token только [A-Za-z0-9_-] (1..256).
// Приводим любой заданный секрет к допустимому виду — одинаково при установке и проверке.
export function safeWebhookSecret(): string {
  return (process.env.TELEGRAM_WEBHOOK_SECRET || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 256);
}

// Отправить текстовое сообщение пользователю.
export async function tgSend(chatId: number | string, text: string): Promise<void> {
  const t = token();
  if (!t) return;
  await fetch(`${API}/bot${t}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  }).catch(() => {});
}

// Отправить сообщение и вернуть его id — чтобы потом дописывать по мере генерации.
export async function tgSendReturningId(chatId: number | string, text: string): Promise<number | null> {
  const t = token();
  if (!t) return null;
  const res = await fetch(`${API}/bot${t}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  }).catch(() => null);
  if (!res) return null;
  const j = await res.json().catch(() => null);
  return j?.result?.message_id ?? null;
}

// Отредактировать ранее отправленное сообщение (для эффекта «печатается»).
export async function tgEdit(chatId: number | string, messageId: number, text: string): Promise<void> {
  const t = token();
  if (!t || !text) return;
  await fetch(`${API}/bot${t}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, disable_web_page_preview: true }),
  }).catch(() => {});
}

// Сообщение с кнопкой, открывающей Mini App (наш веб-интерфейс внутри Telegram).
export async function tgSendWebApp(
  chatId: number | string,
  text: string,
  url: string,
  btn = "Открыть Асю 🤍",
): Promise<void> {
  const t = token();
  if (!t) return;
  await fetch(`${API}/bot${t}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: { inline_keyboard: [[{ text: btn, web_app: { url } }]] },
    }),
  }).catch(() => {});
}

// Показать «печатает…» — пока Ася думает.
export async function tgTyping(chatId: number | string): Promise<void> {
  const t = token();
  if (!t) return;
  await fetch(`${API}/bot${t}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action: "typing" }),
  }).catch(() => {});
}

// Кризисный ответ в виде одного тёплого сообщения с контактами.
export function crisisText(): string {
  const contacts = CRISIS_REPLY.contacts.map((c) => `• ${c.label}${c.note ? ` — ${c.note}` : ""}`).join("\n");
  return `${CRISIS_REPLY.text}\n\n${contacts}`;
}

// Приветствие при /start.
export const TG_WELCOME =
  "Привет, я Ася 🤍\nЯ рядом, чтобы выслушать и побыть с тобой — без осуждения и советов свысока.\n\n" +
  "Чтобы говорить по-настоящему, подскажи, как к тебе обращаться — в женском роде или мужском? Спрашиваю только для этого, и это останется между нами.\n\n" +
  "А можно просто начать — расскажи, как ты сегодня?";

// --- Комьюнити-менеджер: модерация и ответы в группе ---

// Удалить сообщение (бот должен быть админом с правом удаления).
export async function tgDeleteMessage(chatId: number | string, messageId: number): Promise<boolean> {
  const t = token();
  if (!t) return false;
  const res = await fetch(`${API}/bot${t}/deleteMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
  }).catch(() => null);
  const j = await res?.json().catch(() => null);
  return Boolean(j?.ok);
}

// Ответить в чат (по желанию — реплаем на сообщение).
export async function tgReply(chatId: number | string, text: string, replyToMessageId?: number): Promise<void> {
  const t = token();
  if (!t || !text) return;
  const body: Record<string, unknown> = { chat_id: chatId, text, disable_web_page_preview: true };
  if (replyToMessageId) body.reply_to_message_id = replyToMessageId;
  await fetch(`${API}/bot${t}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}

// Проверить, админ ли участник (чтобы не модерировать своих же модераторов).
export async function tgIsChatAdmin(chatId: number | string, userId: number | string): Promise<boolean> {
  const t = token();
  if (!t) return false;
  const res = await fetch(`${API}/bot${t}/getChatMember`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, user_id: userId }),
  }).catch(() => null);
  const j = await res?.json().catch(() => null);
  const st = j?.result?.status;
  return st === "administrator" || st === "creator";
}

// Замьютить участника (капча/антиспам): запрещаем отправку до прохождения проверки.
export async function tgRestrict(chatId: number | string, userId: number | string, canSend: boolean): Promise<void> {
  const t = token();
  if (!t) return;
  const perms = canSend
    ? { can_send_messages: true, can_send_audios: true, can_send_documents: true, can_send_photos: true, can_send_videos: true, can_send_video_notes: true, can_send_voice_notes: true, can_send_polls: true, can_send_other_messages: true, can_add_web_page_previews: true }
    : { can_send_messages: false };
  await fetch(`${API}/bot${t}/restrictChatMember`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, user_id: userId, permissions: perms }),
  }).catch(() => {});
}

// Забанить участника (спамер из базы, злостное нарушение).
export async function tgBan(chatId: number | string, userId: number | string): Promise<void> {
  const t = token();
  if (!t) return;
  await fetch(`${API}/bot${t}/banChatMember`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, user_id: userId }),
  }).catch(() => {});
}

// Сообщение с inline-кнопками (капча и т.п.). buttons: [[{text, callback_data}]]
export async function tgSendInline(
  chatId: number | string,
  text: string,
  buttons: { text: string; callback_data: string }[][],
): Promise<number | null> {
  const t = token();
  if (!t) return null;
  const res = await fetch(`${API}/bot${t}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, reply_markup: { inline_keyboard: buttons }, disable_web_page_preview: true }),
  }).catch(() => null);
  const j = await res?.json().catch(() => null);
  return j?.result?.message_id ?? null;
}

// Ответить на нажатие inline-кнопки (всплывашка).
export async function tgAnswerCallback(callbackId: string, text?: string, alert = false): Promise<void> {
  const t = token();
  if (!t) return;
  await fetch(`${API}/bot${t}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackId, text: text || "", show_alert: alert }),
  }).catch(() => {});
}
