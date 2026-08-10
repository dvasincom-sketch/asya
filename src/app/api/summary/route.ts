import { NextRequest } from "next/server";
import { summarize } from "@/lib/summary";
import { findClientByToken, bumpUsage } from "@/lib/apiClients";

export const runtime = "nodejs";

function extractToken(req: NextRequest): string {
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  return bearer || req.headers.get("x-api-key") || req.nextUrl.searchParams.get("key") || "";
}
function envKeys(): string[] {
  return (process.env.SUMMARY_API_KEY || "").split(",").map((s) => s.trim()).filter(Boolean);
}

export async function POST(req: NextRequest) {
  const token = extractToken(req);
  if (!token) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });

  // Сначала — проект из БД (со своей инструкцией), иначе — legacy-ключ из env.
  const client = await findClientByToken(token).catch(() => null);
  const legacy = !client && envKeys().includes(token);
  if (!client && !legacy) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (client && client.capability !== "summary") return Response.json({ ok: false, error: "forbidden", text: "Ключ проекта не имеет доступа к саммари." }, { status: 403 });

  const b = (await req.json().catch(() => null)) as { transcript?: string; title?: string; source?: string; lang?: string; refresh?: boolean; context?: string } | null;
  const transcript = (b?.transcript || "").trim();
  if (transcript.length < 30) return Response.json({ ok: false, error: "transcript_too_short", text: "Нужен транскрипт (минимум 30 символов)." }, { status: 400 });

  try {
    if (client) void bumpUsage(client.id);
    const r = await summarize({ transcript, title: b?.title, source: b?.source, lang: b?.lang, refresh: Boolean(b?.refresh), instruction: client?.instruction || undefined, context: b?.context });
    return Response.json({
      ok: true,
      project: client?.name || null,
      cached: r.cached,
      hash: r.hash,
      chars: r.chars,
      tldr: r.tldr,
      points: r.points,
      summary: [r.tldr, ...r.points.map((p) => `• ${p}`)].filter(Boolean).join("\n"),
    });
  } catch (e) {
    console.error("[api/summary]", e instanceof Error ? e.message : String(e));
    return Response.json({ ok: false, error: "internal" }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({ ok: true, service: "asya-summary", method: "POST", auth: "Authorization: Bearer <ключ проекта> | x-api-key", body: { transcript: "string (required)", title: "string?", source: "string?", lang: "string?", refresh: "boolean?" } });
}
