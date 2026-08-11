import { NextRequest } from "next/server";
import { complete } from "@/lib/timeweb";
import type { ChatMessage } from "@/lib/crisis";
import { findClientByToken, bumpUsage } from "@/lib/apiClients";
import { buildProjectContext } from "@/lib/projectDocs";

export const runtime = "nodejs";

function extractToken(req: NextRequest): string {
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  return bearer || req.headers.get("x-api-key") || req.nextUrl.searchParams.get("key") || "";
}

// Достаём один JSON-объект из ответа модели (снимаем ```-ограждения, берём первый {...}).
function parseJsonLoose(raw: string): unknown | null {
  let t = (raw || "").trim();
  t = t.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first === -1 || last <= first) return null;
  const slice = t.slice(first, last + 1);
  try { return JSON.parse(slice); } catch { return null; }
}

type Body = {
  input?: string;
  messages?: Array<{ role?: string; content?: string }>;
  system?: string;
  json?: boolean;
  maxTokens?: number;
};

/**
 * Универсальный вызов Аси с контекстом проекта.
 * Системный контекст = документы проекта (buildProjectContext) [+ инструкция].
 * Тело: { input } ИЛИ OpenAI-совместимо { messages:[{role,content}] }.
 * json:true — вернуть распарсенный объект (Ася обязана вернуть строго JSON).
 * Авторизация — ключ проекта (Bearer / x-api-key / ?key).
 */
export async function POST(req: NextRequest) {
  const token = extractToken(req);
  if (!token) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const client = await findClientByToken(token).catch(() => null);
  if (!client) return Response.json({ ok: false, error: "forbidden", text: "Нужен ключ проекта." }, { status: 403 });

  const b = (await req.json().catch(() => null)) as Body | null;

  // Пользовательская часть: либо messages (OpenAI-стиль), либо просто input.
  let msgs: ChatMessage[] = [];
  if (Array.isArray(b?.messages) && b!.messages.length) {
    msgs = b!.messages
      .filter((m) => m && typeof m.content === "string" && (m.role === "user" || m.role === "assistant"))
      .map((m) => ({ role: m.role as "user" | "assistant", content: String(m.content).slice(0, 24000) }));
  } else if (typeof b?.input === "string" && b.input.trim()) {
    msgs = [{ role: "user", content: b.input.slice(0, 24000) }];
  }
  if (!msgs.length) return Response.json({ ok: false, error: "no_input", text: "Передай input или messages." }, { status: 400 });

  // Системный контекст проекта живёт на стороне Аси (документы проекта).
  const docs = await buildProjectContext(client.id).catch(() => "");
  const wantJson = b?.json === true; // строгий JSON только по явному флагу
  const jsonHint = wantJson ? "\n\nВерни СТРОГО один JSON-объект и ничего кроме него: без markdown, без ```-ограждений, без текста до или после." : "";
  const system = [docs, client.instruction || "", (b?.system || "").trim(), jsonHint].filter(Boolean).join("\n\n").trim()
    || "Ты — Ася, ассистент проекта. Отвечай по существу.";

  void bumpUsage(client.id);
  const maxTokens = Math.min(Math.max(Number(b?.maxTokens) || 1500, 200), 4000);
  const output = await complete(msgs, system, maxTokens).catch(() => "");
  if (!output) return Response.json({ ok: false, error: "empty", text: "Модель не вернула ответ." }, { status: 502 });

  if (wantJson) {
    const parsed = parseJsonLoose(output);
    if (parsed === null) return Response.json({ ok: false, error: "bad_json", text: "Ответ не распарсился как JSON.", output });
    return Response.json({ ok: true, project: client.name, json: parsed, output });
  }
  return Response.json({ ok: true, project: client.name, output });
}

export async function GET() {
  return Response.json({
    ok: true,
    service: "asya-generate",
    method: "POST",
    auth: "Authorization: Bearer <ключ проекта> | x-api-key | ?key",
    body: {
      input: "string — пользовательская часть (напр. список коммитов)",
      messages: "[{role:'user'|'assistant', content}] — вместо input (OpenAI-стиль)",
      system: "string? — доп. системная приписка поверх документов проекта",
      json: "boolean? — true: вернуть распарсенный JSON",
      maxTokens: "number? — по умолчанию 1500",
    },
    response: { ok: true, project: "string", output: "string — сырой текст ответа", json: "object — если json:true" },
    note: "Системный контекст = документы проекта на стороне Аси. Схема — своя (не OpenAI): текст лежит в output, разобранный объект — в json.",
  });
}
