import { getCurrentUser } from "@/lib/auth";
import { introsDb, roomMemberDb, roomMsgDb } from "@/lib/networkDb";

export const runtime = "nodejs";

// Лёгкий счётчик «твой ход» для бейджа в чате: сколько интро ждут действия человека.
//  - входящие, где ты кандидат и статус proposed (нужно откликнуться)
//  - исходящие, где ты заказчик и кандидат уже согласился (нужно выбрать)
export async function GET() {
  const u = await getCurrentUser().catch(() => null);
  if (!u) return Response.json({ count: 0 });
  const [incoming, toSelect] = await Promise.all([
    introsDb().findMany({ where: { candidateId: u.id, status: "proposed" }, take: 100 }).catch(() => []),
    introsDb().findMany({ where: { requesterId: u.id, status: "candidate_accepted" }, take: 100 }).catch(() => []),
  ]);
  // Непрочитанное из комнат-чатов — для бейджа на кнопке «Румы».
  const memberships = await roomMemberDb().findMany({ where: { userId: u.id }, take: 100 }).catch(() => []);
  let roomsUnread = 0;
  for (const m of memberships) {
    roomsUnread += await roomMsgDb()
      .count({ where: { roomId: m.roomId, createdAt: { gt: m.lastReadAt }, NOT: { senderId: u.id } } })
      .catch(() => 0);
  }

  return Response.json({ count: incoming.length + toSelect.length, roomsUnread });
}
