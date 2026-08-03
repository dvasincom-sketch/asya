import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { introsDb, offersDb, requestsDb, reportDb, roomDb, userTgId } from "@/lib/networkDb";
import { ensureRoom } from "@/lib/rooms";
import { tgSendWebApp } from "@/lib/tgbot";

export const runtime = "nodejs";

// Превью запроса для кандидата — без личности заказчика, только суть и критерии.
function requestPreview(criteria: string | null, note: string | null) {
  let cr: Record<string, unknown> = {};
  try { cr = criteria ? JSON.parse(criteria) : {}; } catch { cr = {}; }
  return { criteria: cr, note: note || null };
}

// GET: две ленты — входящие (я кандидат) и исходящие (я заказчик).
// Контакты раскрываются ТОЛЬКО при статусе contact_shared (взаимное согласие).
export async function GET() {
  const u = await getCurrentUser().catch(() => null);
  if (!u) return Response.json({ incoming: [], outgoing: [] });

  const [asCandidate, asRequester] = await Promise.all([
    introsDb().findMany({ where: { candidateId: u.id }, orderBy: { createdAt: "desc" }, take: 100 }).catch(() => []),
    introsDb().findMany({ where: { requesterId: u.id }, orderBy: { createdAt: "desc" }, take: 100 }).catch(() => []),
  ]);

  // Входящие: показываем превью запроса + какой мой оффер подошёл.
  const incoming = [];
  for (const it of asCandidate) {
    if (it.status === "candidate_declined" || it.status === "closed") continue;
    const [offer, request] = await Promise.all([
      offersDb().findUnique({ where: { id: it.offerId } }).catch(() => null),
      requestsDb().findUnique({ where: { id: it.requestId } }).catch(() => null),
    ]);
    const shared = it.status === "contact_shared";
    const roomId = shared ? (await roomDb().findUnique({ where: { introId: it.id } }).catch(() => null))?.id ?? null : null;
    incoming.push({
      id: it.id,
      status: it.status,
      myOffer: offer ? { id: offer.id, title: offer.title, category: offer.category } : null,
      request: request ? requestPreview(request.criteria, request.note) : { criteria: {}, note: null },
      category: request?.category || offer?.category || null,
      roomId,
    });
  }

  // Исходящие: группируем по запросу, карточки откликнувшихся кандидатов (оффер, без личности до раскрытия).
  const outMap: Record<string, { requestId: string; category: string; criteria: Record<string, unknown>; note: string | null; candidates: unknown[] }> = {};
  for (const it of asRequester) {
    if (it.status === "candidate_declined" || it.status === "closed") continue;
    const request = await requestsDb().findUnique({ where: { id: it.requestId } }).catch(() => null);
    if (!request) continue;
    if (!outMap[it.requestId]) {
      const pv = requestPreview(request.criteria, request.note);
      outMap[it.requestId] = { requestId: it.requestId, category: request.category, criteria: pv.criteria, note: pv.note, candidates: [] };
    }
    const offer = await offersDb().findUnique({ where: { id: it.offerId } }).catch(() => null);
    const shared2 = it.status === "contact_shared";
    const roomId2 = shared2 ? (await roomDb().findUnique({ where: { introId: it.id } }).catch(() => null))?.id ?? null : null;
    outMap[it.requestId].candidates.push({
      introId: it.id,
      status: it.status,
      accepted: it.candidateOk,
      selected: it.requesterOk,
      offer: offer ? { title: offer.title, blurb: offer.blurb, category: offer.category } : null,
      roomId: roomId2,
    });
  }

  return Response.json({ incoming, outgoing: Object.values(outMap) });
}

// POST: действия в петле знакомства.
//  accept  (кандидат)  — согласиться быть предложенным заказчику
//  decline (кандидат)  — отказаться
//  select  (заказчик)  — выбрать кандидата; при взаимном согласии контакты раскрываются
export async function POST(req: NextRequest) {
  const u = await getCurrentUser().catch(() => null);
  if (!u) return Response.json({ error: "auth" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const introId = String(b.introId || "");
  const action = String(b.action || "");
  const it = await introsDb().findUnique({ where: { id: introId } }).catch(() => null);
  if (!it) return Response.json({ error: "not_found" }, { status: 404 });

  const base = (process.env.PUBLIC_BASE_URL || req.nextUrl.origin).replace(/\/$/, "");
  const link = `${base}/account/network`;

  if (action === "accept" || action === "decline") {
    if (it.candidateId !== u.id) return Response.json({ error: "forbidden" }, { status: 403 });
    if (action === "decline") {
      await introsDb().update({ where: { id: introId }, data: { status: "candidate_declined" } }).catch(() => {});
      return Response.json({ ok: true });
    }
    // accept: если заказчик уже выбрал — взаимно, раскрываем контакты.
    const mutual = it.requesterOk;
    await introsDb().update({
      where: { id: introId },
      data: { candidateOk: true, status: mutual ? "contact_shared" : "candidate_accepted" },
    }).catch(() => {});
    if (mutual) await ensureRoom(it.id, it.requesterId, it.candidateId).catch(() => null);
    const reqTg = await userTgId(it.requesterId);
    if (reqTg) {
      await tgSendWebApp(reqTg, mutual
        ? "Взаимно 🤍 Вы совпали — Ася открыла общий чат, загляни."
        : "Кандидат откликнулся на твой запрос 🤍 Посмотри карточку и реши.", link);
    }
    return Response.json({ ok: true, mutual });
  }

  if (action === "select") {
    if (it.requesterId !== u.id) return Response.json({ error: "forbidden" }, { status: 403 });
    const mutual = it.candidateOk;
    await introsDb().update({
      where: { id: introId },
      data: { requesterOk: true, status: mutual ? "contact_shared" : "requester_selected" },
    }).catch(() => {});
    if (mutual) await ensureRoom(it.id, it.requesterId, it.candidateId).catch(() => null);
    const candTg = await userTgId(it.candidateId);
    if (candTg) {
      await tgSendWebApp(candTg, mutual
        ? "Взаимно 🤍 Тебя выбрали — Ася открыла общий чат, загляни."
        : "Тебя выбрали по твоему предложению 🤍 Подтверди у Аси, чтобы открыть контакты.", link);
    }
    return Response.json({ ok: true, mutual });
  }

  if (action === "report") {
    // Личность скрыта на клиенте — цель определяем на сервере по интро.
    const iAmCandidate = it.candidateId === u.id;
    const iAmRequester = it.requesterId === u.id;
    if (!iAmCandidate && !iAmRequester) return Response.json({ error: "forbidden" }, { status: 403 });
    const target = iAmCandidate ? it.requesterId : it.candidateId;
    const reason = String(b.reason || "network").slice(0, 60);
    const note = b.note ? String(b.note).slice(0, 1000) : null;
    await reportDb().create({ data: { reporterId: u.id, targetUserId: target, reason, note } }).catch(() => {});
    await introsDb().update({ where: { id: introId }, data: { status: "closed" } }).catch(() => {});
    return Response.json({ ok: true });
  }

  return Response.json({ error: "bad_action" }, { status: 400 });
}
