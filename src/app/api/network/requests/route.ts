import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { offersDb, requestsDb, introsDb, blockDb, userTgId } from "@/lib/networkDb";
import { isCategory, categoryLive, matchOffers, type OfferLite } from "@/lib/network";
import { tgSendWebApp } from "@/lib/tgbot";

export const runtime = "nodejs";

export async function GET() {
  const u = await getCurrentUser().catch(() => null);
  if (!u) return Response.json({ requests: [] });
  const rows = await requestsDb().findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, take: 50 }).catch(() => []);
  return Response.json({
    requests: rows.map((r) => ({
      id: r.id, category: r.category, criteria: r.criteria ? JSON.parse(r.criteria) : {},
      note: r.note, status: r.status, deadline: r.deadline,
    })),
  });
}

export async function POST(req: NextRequest) {
  const u = await getCurrentUser().catch(() => null);
  if (!u) return Response.json({ error: "auth" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const category = String(b.category || "");
  if (!isCategory(category)) return Response.json({ error: "bad_category" }, { status: 400 });

  const criteriaObj = b.criteria && typeof b.criteria === "object" ? b.criteria : {};
  const days = typeof b.deadlineDays === "number" && b.deadlineDays > 0 ? Math.min(b.deadlineDays, 60) : 7;
  const deadline = new Date(Date.now() + days * 86400000);

  const created = await requestsDb()
    .create({
      data: {
        userId: u.id,
        category,
        criteria: JSON.stringify(criteriaObj).slice(0, 4000),
        note: b.note ? String(b.note).slice(0, 500) : null,
        status: "open",
        deadline,
      },
    })
    .catch(() => null);
  if (!created) return Response.json({ error: "server" }, { status: 500 });

  // Матчинг — только в live-категории (предохранитель для нянь/знакомств).
  let matched = 0;
  if (categoryLive(category)) {
    matched = await runMatch(created.id, u.id, category, criteriaObj, req.nextUrl.origin);
  }
  return Response.json({ ok: true, id: created.id, matched });
}

export async function DELETE(req: NextRequest) {
  const u = await getCurrentUser().catch(() => null);
  if (!u) return Response.json({ error: "auth" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const id = String(b.id || "");
  const cur = await requestsDb().findUnique({ where: { id } }).catch(() => null);
  if (cur && cur.userId === u.id) await requestsDb().delete({ where: { id } }).catch(() => {});
  return Response.json({ ok: true });
}

// Подобрать активные офферы под запрос, создать интро и уведомить кандидатов.
export async function runMatch(
  requestId: string,
  requesterId: string,
  category: string,
  criteria: Record<string, unknown>,
  origin: string,
): Promise<number> {
  const offers = await offersDb().findMany({ where: { category, status: "active" }, take: 200 }).catch(() => []);
  const blocks = await blockDb().findMany({ where: { OR: [{ userId: requesterId }, { blockedId: requesterId }] } }).catch(() => []);
  const blockedIds = new Set<string>();
  for (const bl of blocks) {
    blockedIds.add(bl.userId === requesterId ? bl.blockedId : bl.userId);
  }
  const lite: OfferLite[] = offers
    .filter((o) => !blockedIds.has(o.userId))
    .map((o) => ({ id: o.id, userId: o.userId, category: o.category, status: o.status, params: o.params }));
  const picks = matchOffers({ id: requestId, userId: requesterId, category, criteria: JSON.stringify(criteria) }, lite);

  const base = (process.env.PUBLIC_BASE_URL || origin).replace(/\/$/, "");
  let n = 0;
  for (const o of picks) {
    const intro = await introsDb()
      .create({
        data: { requestId, offerId: o.id, candidateId: o.userId, requesterId, status: "proposed" },
      })
      .catch(() => null); // уникальность (requestId, offerId) отсеет повторы
    if (!intro) continue;
    n += 1;
    const tg = await userTgId(o.userId);
    if (tg) {
      await tgSendWebApp(
        tg,
        "Кто-то ищет как раз то, что ты предлагаешь 🤍 Ася может предложить тебя — загляни и реши сама.",
        `${base}/account/network`,
      );
    }
  }
  return n;
}
