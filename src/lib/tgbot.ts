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
