// Тонкая обёртка над Telegram Bot API.
import { CRISIS_REPLY } from "./crisis";

const API = "https://api.telegram.org";

function token(): string {
  return process.env.TELEGRAM_BOT_TOKEN || "";
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
