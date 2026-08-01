// Обёртка над моделью через OpenAI-совместимый API (агент Timeweb или напрямую OpenAI).
// Устойчива к разным семействам моделей: если модель не принимает классические параметры
// (temperature/top_p/max_tokens) и отвечает 400 — автоматически повторяем в «совместимом»
// виде (max_completion_tokens, без temperature/top_p), как хотят reasoning-модели OpenAI.
import { SYSTEM_PROMPT } from "./prompt";
import type { ChatMessage } from "./crisis";

const BASE_URL = process.env.TIMEWEB_BASE_URL || "https://api.timeweb.ai/v1";
const MODEL = process.env.TIMEWEB_MODEL || "t-tech/T-pro-it-1.0";

export function hasKey(): boolean {
  return Boolean(process.env.TIMEWEB_API_KEY);
}

type CallOpts = { stream: boolean; compat: boolean; temperature: number; maxTokens: number };

function buildBody(system: string, msgs: ChatMessage[], o: CallOpts): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: MODEL,
    stream: o.stream,
    messages: [{ role: "system", content: system }, ...msgs],
  };
  if (o.compat) {
    // Совместимый режим: часть моделей принимает только это.
    body.max_completion_tokens = o.maxTokens;
  } else {
    body.max_tokens = o.maxTokens;
    body.temperature = o.temperature;
    body.top_p = 0.9;
  }
  return body;
}

function chatFetch(system: string, msgs: ChatMessage[], o: CallOpts): Promise<Response> {
  return fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.TIMEWEB_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildBody(system, msgs, o)),
  });
}

// «Сырой» стрим (SSE) в браузер. systemExtra — дополнение к system-prompt (память, профиль…).
export async function streamChat(messages: ChatMessage[], systemExtra = ""): Promise<Response> {
  const trimmed = messages.slice(-20);
  const system = SYSTEM_PROMPT + systemExtra;
  const base = { stream: true, temperature: 0.8, maxTokens: 700 };
  const res = await chatFetch(system, trimmed, { ...base, compat: false });
  if (res.ok || res.status !== 400) return res;
  res.body?.cancel?.().catch(() => {});
  return chatFetch(system, trimmed, { ...base, compat: true });
}

async function completeInternal(
  system: string,
  msgs: ChatMessage[],
  temperature: number,
  maxTokens: number,
): Promise<string> {
  try {
    let res = await chatFetch(system, msgs, { stream: false, compat: false, temperature, maxTokens });
    if (!res.ok && res.status === 400) {
      res = await chatFetch(system, msgs, { stream: false, compat: true, temperature, maxTokens });
    }
    if (!res.ok) return "";
    const j = await res.json();
    return String(j?.choices?.[0]?.message?.content ?? "");
  } catch {
    return "";
  }
}

// Нестримовый ответ Асей — для Telegram (сообщения приходят целиком).
export function completeChat(messages: ChatMessage[], systemExtra = ""): Promise<string> {
  return completeInternal(SYSTEM_PROMPT + systemExtra, messages.slice(-20), 0.8, 700);
}

// Служебный вызов модели (извлечение фактов, разбор документов, тексты касаний).
export function complete(messages: ChatMessage[], system: string, maxTokens = 300): Promise<string> {
  return completeInternal(system, messages, 0.2, maxTokens);
}
