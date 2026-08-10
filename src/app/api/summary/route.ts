import { NextRequest } from "next/server";
import { summarize } from "@/lib/summary";

export const runtime = "nodejs";

// Ключи внешних проектов: SUMMARY_API_KEY (можно несколько через запятую).
function authed(req: NextRequest): boolean {
  const raw = process.env.SUMMARY_API_KEY || "";
  const keys = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (!keys.length) return false; // без заданного ключа доступ закрыт
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const got = bearer || req.headers.get("x-api-key") || req.nextUrl.searchParams.get("key") || "";
  return keys.includes(got);
}

export async function POST(req: NextRequest) {
  if (!authed(req)) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => null)) as { transcript?: string; title?: string; source?: string; lang?: string; refresh?: boolean } | null;
  const transcript = (b?.transcript || "").trim();
  if (transcript.length < 30) return Response.json({ ok: false, error: "transcript_too_short", text: "Нужен транскрипт (минимум 30 символов)." }, { status: 400 });

  try {
    const r = await summarize({ transcript, title: b?.title, source: b?.source, lang: b?.lang, refresh: Boolean(b?.refresh) });
    return Response.json({
      ok: true,
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
  return Response.json({ ok: true, service: "asya-summary", method: "POST", auth: "Authorization: Bearer <key> | x-api-key", body: { transcript: "string (required)", title: "string?", source: "string?", lang: "string?", refresh: "boolean?" } });
}
