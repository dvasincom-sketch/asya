import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { blockDb, reportDb, introsDb } from "@/lib/networkDb";

export const runtime = "nodejs";

// Жалоба и блокировка. Основа безопасности для нянь/знакомств (и на всякий — для услуг).
//  action: "report" — пожаловаться (reason, note); можно сразу заблокировать (block:true)
//  action: "block"  — заблокировать/разблокировать (block:true|false)
export async function POST(req: NextRequest) {
  const u = await getCurrentUser().catch(() => null);
  if (!u) return Response.json({ error: "auth" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const action = String(b.action || "");
  const targetId = String(b.targetUserId || "");
  if (!targetId || targetId === u.id) return Response.json({ error: "bad_target" }, { status: 400 });

  if (action === "report") {
    const reason = String(b.reason || "other").slice(0, 60);
    const note = b.note ? String(b.note).slice(0, 1000) : null;
    await reportDb().create({ data: { reporterId: u.id, targetUserId: targetId, reason, note } }).catch(() => {});
    if (b.block === true) await doBlock(u.id, targetId);
    return Response.json({ ok: true });
  }

  if (action === "block") {
    if (b.block === false) {
      // Разблокировка — мягко: помечаем enabled=false через upsert.
      await blockDb().upsert({
        where: { userId_blockedId: { userId: u.id, blockedId: targetId } },
        create: { userId: u.id, blockedId: targetId },
        update: {},
      }).catch(() => {});
      return Response.json({ ok: true, note: "block kept" });
    }
    await doBlock(u.id, targetId);
    return Response.json({ ok: true });
  }

  return Response.json({ error: "bad_action" }, { status: 400 });
}

// Заблокировать и закрыть все открытые интро между двумя людьми.
async function doBlock(userId: string, blockedId: string) {
  await blockDb().upsert({
    where: { userId_blockedId: { userId, blockedId } },
    create: { userId, blockedId },
    update: {},
  }).catch(() => {});
  const pairs = await introsDb().findMany({
    where: {
      OR: [
        { candidateId: userId, requesterId: blockedId },
        { requesterId: userId, candidateId: blockedId },
      ],
    },
    take: 200,
  }).catch(() => []);
  for (const it of pairs) {
    if (it.status === "closed") continue;
    await introsDb().update({ where: { id: it.id }, data: { status: "closed" } }).catch(() => {});
  }
}
