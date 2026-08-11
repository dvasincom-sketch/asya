import { NextRequest } from "next/server";
import { findClientByToken, bumpUsage } from "@/lib/apiClients";
import { addCorrection } from "@/lib/corrections";
import { upsertVideoKnowledge } from "@/lib/knowledge";

export const runtime = "nodejs";

function extractToken(req: NextRequest): string {
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  return bearer || req.headers.get("x-api-key") || req.nextUrl.searchParams.get("key") || "";
}

/**
 * Обратная связь из студии проекта: редактор поправил саммари (или главы) →
 * сохраняем правку как обучающий пример. Правка также обновляет «эталонное»
 * знание по видео. Требуется ключ проекта (не legacy-env).
 * Body: { source?, title?, url?, kind?, before?, after }
 */
export async function POST(req: NextRequest) {
  const token = extractToken(req);
  if (!token) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const client = await findClientByToken(token).catch(() => null);
  if (!client) return Response.json({ ok: false, error: "forbidden", text: "Обучение доступно только проектам с ключом." }, { status: 403 });

  const b = (await req.json().catch(() => null)) as
    | { source?: string; title?: string; url?: string; kind?: string; before?: string; after?: string }
    | null;
  const after = String(b?.after || "").trim();
  if (!after) return Response.json({ ok: false, error: "no_after", text: "Нужен отредактированный текст." }, { status: 400 });

  void bumpUsage(client.id);
  await addCorrection({
    clientId: client.id,
    source: b?.source,
    title: b?.title,
    kind: b?.kind || "summary",
    before: b?.before,
    after,
  });
  if (b?.source) {
    await upsertVideoKnowledge({ clientId: client.id, source: String(b.source), title: b?.title, url: b?.url, summary: after });
  }
  return Response.json({ ok: true, project: client.name });
}

export async function GET() {
  return Response.json({ ok: true, service: "asya-feedback", method: "POST", body: { after: "string (required)", source: "string?", title: "string?", before: "string?", kind: "summary|chapters?" } });
}
