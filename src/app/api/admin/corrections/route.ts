import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function authed(req: NextRequest): boolean {
  const key = process.env.ADMIN_KEY;
  return Boolean(key) && req.nextUrl.searchParams.get("key") === key;
}

type CorrRow = { id: string; clientId: string; source: string | null; title: string | null; kind: string; before: string | null; after: string; createdAt: Date };
type VkRow = { id: string; clientId: string; source: string; title: string | null; url: string | null; summary: string | null; chapters: string | null; updatedAt: Date };

type CorrDelegate = {
  findMany: (a: { where?: Record<string, unknown>; orderBy?: unknown; take?: number }) => Promise<CorrRow[]>;
  groupBy?: (a: unknown) => Promise<Array<{ clientId: string; _count: { _all: number } }>>;
};
type VkDelegate = {
  findMany: (a: { where?: Record<string, unknown>; orderBy?: unknown; take?: number }) => Promise<VkRow[]>;
};
function corrDb(): CorrDelegate {
  return (prisma as unknown as { projectCorrection: CorrDelegate }).projectCorrection;
}
function vkDb(): VkDelegate {
  return (prisma as unknown as { videoKnowledge: VkDelegate }).videoKnowledge;
}

// Счётчики по проектам: сколько правок и знаний у каждого клиента.
async function counts(): Promise<{ corrections: Record<string, number>; knowledge: Record<string, number> }> {
  const corrections: Record<string, number> = {};
  const knowledge: Record<string, number> = {};
  try {
    const c = await prisma.$queryRawUnsafe<Array<{ clientId: string; n: number | bigint }>>(
      `SELECT "clientId", COUNT(*)::int AS n FROM "ProjectCorrection" GROUP BY "clientId"`,
    );
    for (const r of c) corrections[r.clientId] = Number(r.n);
  } catch { /* таблицы может не быть до миграции */ }
  try {
    const k = await prisma.$queryRawUnsafe<Array<{ clientId: string; n: number | bigint }>>(
      `SELECT "clientId", COUNT(*)::int AS n FROM "VideoKnowledge" GROUP BY "clientId"`,
    );
    for (const r of k) knowledge[r.clientId] = Number(r.n);
  } catch { /* ignore */ }
  return { corrections, knowledge };
}

/**
 * Что Ася накопила по проекту: правки (обучение саммари) и знание по видео.
 * Без clientId — только счётчики по всем проектам (для бейджей в списке).
 * С clientId — последние правки и знания этого проекта.
 */
export async function GET(req: NextRequest) {
  if (!authed(req)) return Response.json({ error: "auth" }, { status: 401 });
  const clientId = req.nextUrl.searchParams.get("clientId") || "";
  try {
    const c = await counts();
    if (!clientId) return Response.json({ ok: true, ...c });

    const corrections = await corrDb()
      .findMany({ where: { clientId }, orderBy: { createdAt: "desc" }, take: 40 })
      .catch(() => [] as CorrRow[]);
    const knowledge = await vkDb()
      .findMany({ where: { clientId }, orderBy: { updatedAt: "desc" }, take: 40 })
      .catch(() => [] as VkRow[]);

    return Response.json({
      ok: true,
      counts: { corrections: c.corrections[clientId] || 0, knowledge: c.knowledge[clientId] || 0 },
      corrections: corrections.map((r) => ({
        id: r.id, source: r.source, title: r.title, kind: r.kind,
        before: r.before, after: r.after, createdAt: r.createdAt,
      })),
      knowledge: knowledge.map((r) => ({
        id: r.id, source: r.source, title: r.title, url: r.url,
        summary: r.summary, hasChapters: Boolean(r.chapters), updatedAt: r.updatedAt,
      })),
    });
  } catch (e) {
    console.error("[admin/corrections]", e instanceof Error ? e.message : String(e));
    return Response.json({ ok: false, error: "db", corrections: [], knowledge: [], counts: { corrections: 0, knowledge: 0 } });
  }
}
