import { NextRequest } from "next/server";
import { titleChapters, type ChapterSeg } from "@/lib/chapters";
import { findClientByToken, bumpUsage } from "@/lib/apiClients";

export const runtime = "nodejs";

function extractToken(req: NextRequest): string {
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  return bearer || req.headers.get("x-api-key") || req.nextUrl.searchParams.get("key") || "";
}
function envKeys(): string[] {
  return (process.env.SUMMARY_API_KEY || "").split(",").map((s) => s.trim()).filter(Boolean);
}

/**
 * Полировка заголовков глав видео. Тот же ключ, что и у саммари: клиент с
 * capability "summary"|"chapters" или legacy-ключ из env. Вход — сегменты глав
 * (время начала + расшифровка речи фрагмента), выход — по одному заголовку на
 * сегмент (тот же порядок и длина).
 * Body: { segments: [{ start:number, text:string }], title?, lang? }
 */
export async function POST(req: NextRequest) {
  const token = extractToken(req);
  if (!token) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const client = await findClientByToken(token).catch(() => null);
  const legacy = !client && envKeys().includes(token);
  if (!client && !legacy) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (client && client.capability !== "summary" && client.capability !== "chapters") {
    return Response.json({ ok: false, error: "forbidden", text: "Ключ проекта не имеет доступа к главам." }, { status: 403 });
  }

  const b = (await req.json().catch(() => null)) as { segments?: unknown; title?: string; lang?: string } | null;
  const raw = Array.isArray(b?.segments) ? (b!.segments as unknown[]) : [];
  const segments: ChapterSeg[] = raw
    .map((x) => {
      const o = (x || {}) as { start?: unknown; text?: unknown };
      return { start: Number(o.start) || 0, text: String(o.text || "") };
    })
    .filter((s) => s.text.trim().length > 0);
  if (!segments.length) return Response.json({ ok: false, error: "no_segments", text: "Нужны сегменты глав." }, { status: 400 });

  try {
    if (client) void bumpUsage(client.id);
    const r = await titleChapters({ segments, title: b?.title, lang: b?.lang, instruction: client?.instruction || undefined });
    return Response.json({ ok: true, project: client?.name || null, titles: r.titles });
  } catch (e) {
    console.error("[api/chapters]", e instanceof Error ? e.message : String(e));
    return Response.json({ ok: false, error: "internal" }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({
    ok: true,
    service: "asya-chapters",
    method: "POST",
    auth: "Authorization: Bearer <ключ проекта> | x-api-key",
    body: { segments: "[{ start:number, text:string }] (required)", title: "string?", lang: "string?" },
  });
}
