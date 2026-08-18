import { NextRequest } from "next/server";
import { composeBlocks } from "@/lib/compose";
import { findClientByToken, bumpUsage } from "@/lib/apiClients";
import { recentCorrections } from "@/lib/corrections";
import { buildProjectContext } from "@/lib/projectDocs";

export const runtime = "nodejs";

/**
 * Разбор сплошного текста на блоки страницы Content-box (конструктор публикаций).
 * Только для проектов-клиентов с capability = "compose". Ключ — секрет, дёргается
 * строго сервер-к-серверу из студии content-box.
 *
 *  POST { text, messages?, blocks?, lang? } → { ok, note, blocks }
 */
function extractToken(req: NextRequest): string {
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  return bearer || req.headers.get("x-api-key") || req.nextUrl.searchParams.get("key") || "";
}

export async function POST(req: NextRequest) {
  const token = extractToken(req);
  if (!token) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const client = await findClientByToken(token).catch(() => null);
  if (!client) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (client.capability !== "compose") {
    return Response.json({ ok: false, error: "forbidden", text: "Ключ проекта не имеет доступа к конструктору." }, { status: 403 });
  }

  const b = (await req.json().catch(() => null)) as
    | { text?: string; messages?: { role: string; content: string }[]; blocks?: unknown[]; lang?: string }
    | null;
  const text = (b?.text || "").trim();
  if (text.length < 30) {
    return Response.json({ ok: false, error: "text_too_short", text: "Нужен текст (минимум 30 символов)." }, { status: 400 });
  }

  try {
    void bumpUsage(client.id);
    const corrections = await recentCorrections(client.id, "compose", 5).catch(() => "");
    const docsCtx = await buildProjectContext(client.id).catch(() => "");
    const instruction = [client.instruction || "", docsCtx].filter(Boolean).join("\n\n") || undefined;
    const r = await composeBlocks({
      text,
      messages: Array.isArray(b?.messages) ? b?.messages : [],
      prevBlocks: Array.isArray(b?.blocks) ? b?.blocks : [],
      lang: b?.lang,
      instruction,
      corrections,
    });
    return Response.json({ ok: true, project: client.name || null, note: r.note, blocks: r.blocks, suggest: r.suggest ?? null });
  } catch (e) {
    console.error("[api/compose]", e instanceof Error ? e.message : String(e));
    return Response.json({ ok: false, error: "internal" }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({
    ok: true,
    service: "asya-compose",
    method: "POST",
    auth: "Authorization: Bearer <ключ проекта capability=compose> | x-api-key",
    body: { text: "string (required, >=30)", messages: "{role,content}[]?", blocks: "block[]?", lang: "string?" },
  });
}
