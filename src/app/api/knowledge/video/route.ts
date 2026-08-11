import { NextRequest } from "next/server";
import { findClientByToken, bumpUsage } from "@/lib/apiClients";
import { upsertVideoKnowledge } from "@/lib/knowledge";

export const runtime = "nodejs";

function extractToken(req: NextRequest): string {
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  return bearer || req.headers.get("x-api-key") || req.nextUrl.searchParams.get("key") || "";
}

/**
 * Пополнение знания Аси по видео проекта (саммари + главы с таймкодами).
 * content-box шлёт сюда при генерации/правке саммари и глав. Ключ проекта.
 * Body: { source, title?, url?, summary?, chapters? }  chapters — [{start,title}] | строка
 */
export async function POST(req: NextRequest) {
  const token = extractToken(req);
  if (!token) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const client = await findClientByToken(token).catch(() => null);
  if (!client) return Response.json({ ok: false, error: "forbidden", text: "Только для проектов с ключом." }, { status: 403 });

  const b = (await req.json().catch(() => null)) as
    | { source?: string; title?: string; url?: string; summary?: string; chapters?: unknown }
    | null;
  const source = String(b?.source || "").trim();
  if (!source) return Response.json({ ok: false, error: "no_source", text: "Нужен идентификатор видео (source)." }, { status: 400 });

  const chapters = typeof b?.chapters === "string" ? b.chapters : b?.chapters ? JSON.stringify(b.chapters) : undefined;
  void bumpUsage(client.id);
  await upsertVideoKnowledge({ clientId: client.id, source, title: b?.title, url: b?.url, summary: b?.summary, chapters });
  return Response.json({ ok: true, project: client.name });
}
