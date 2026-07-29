// Обёртка над Timeweb AI Gateway (OpenAI-совместимый API).
import { SYSTEM_PROMPT } from "./prompt";
import type { ChatMessage } from "./crisis";

const BASE_URL = process.env.TIMEWEB_BASE_URL || "https://api.timeweb.ai/v1";
const MODEL = process.env.TIMEWEB_MODEL || "t-tech/T-pro-it-1.0";

export function hasKey(): boolean {
  return Boolean(process.env.TIMEWEB_API_KEY);
}

// Возвращает «сырой» ответ fetch со стримом (SSE), который прокидываем в браузер.
// systemExtra — дополнение к system-prompt (например, память о человеке).
export function streamChat(messages: ChatMessage[], systemExtra = ""): Promise<Response> {
  const trimmed = messages.slice(-20);
  const system = SYSTEM_PROMPT + systemExtra;
  return fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.TIMEWEB_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      stream: true,
      temperature: 0.8,
      top_p: 0.9,
      max_tokens: 700,
      messages: [{ role: "system", content: system }, ...trimmed],
    }),
  });
}
