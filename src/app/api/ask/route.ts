import { NextRequest } from "next/server";
import { findClientByToken, bumpUsage } from "@/lib/apiClients";
import { searchKnowledge, answerFromKnowledge } from "@/lib/knowledge";

export const runtime = "nodejs";

function extractToken(req: NextRequest): string {
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  return bearer || req.headers.get("x-api-key") || req.nextUrl.searchParams.get("key") || "";
}

/**
 * Вопрос-ответ по видео проекта: ищем в знании Аси (VideoKnowledge) и отвечаем
 * с названием видео и тайм-кодом момента. Это бэкенд для панели «Спросить Асю»
 * на фан-сайте (доступ гейтит сам сайт — по подписке). Ключ проекта.
 * Body: { q } → { ok, answer, matches:[{title,url,source}] }
 */
export async function POST(req: NextRequest) {
  const token = extractToken(req);
  if (!token) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const client = await findClientByToken(token).catch(() => null);
  if (!client) return Response.json({ ok: false, error: "forbidden", text: "Только для проектов с ключом." }, { status: 403 });

  const b = (await req.json().catch(() => null)) as { q?: string } | null;
  const q = String(b?.q || "").trim();
  if (q.length < 2) return Response.json({ ok: false, error: "no_query", text: "Задайте вопрос." }, { status: 400 });

  void bumpUsage(client.id);
  const rows = await searchKnowledge(client.id, q, 4);
  const answer = await answerFromKnowledge(q, rows);
  return Response.json({
    ok: true,
    project: client.name,
    answer,
    matches: rows.map((r) => ({ title: r.title, url: r.url, source: r.source })),
  });
}

export async function GET() {
  return Response.json({ ok: true, service: "asya-ask", method: "POST", body: { q: "string (required)" } });
}
