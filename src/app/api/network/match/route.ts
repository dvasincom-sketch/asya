import { NextRequest } from "next/server";
import { requestsDb } from "@/lib/networkDb";
import { categoryLive } from "@/lib/network";
import { runMatch } from "../requests/route";

export const runtime = "nodejs";

// Крон-петля матчинга. Защищён ключом:
//   GET https://<домен>/api/network/match?key=<TELEGRAM_WEBHOOK_SECRET>
// Что делает: закрывает просроченные запросы (deadline прошёл → expired)
// и повторно ищет кандидатов для открытых запросов в live-категориях.
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET || process.env.CRON_SECRET;
  if (!secret || key !== secret) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const base = (process.env.PUBLIC_BASE_URL || req.nextUrl.origin).replace(/\/$/, "");
  const open = await requestsDb().findMany({ where: { status: "open" }, take: 500 }).catch(() => []);
  const now = Date.now();
  let expired = 0;
  let rematched = 0;

  for (const r of open) {
    // Просрочен — Ася берёт паузу до дедлайна, потом мягко закрывает.
    if (r.deadline && new Date(r.deadline).getTime() < now) {
      await requestsDb().update({ where: { id: r.id }, data: { status: "expired" } }).catch(() => {});
      expired += 1;
      continue;
    }
    if (!categoryLive(r.category)) continue;
    let cr: Record<string, unknown> = {};
    try { cr = r.criteria ? JSON.parse(r.criteria) : {}; } catch { cr = {}; }
    // runMatch идемпотентен: уникальность (requestId, offerId) отсекает уже созданные интро.
    rematched += await runMatch(r.id, r.userId, r.category, cr, base).catch(() => 0);
  }

  return Response.json({ ok: true, scanned: open.length, expired, newIntros: rematched });
}
