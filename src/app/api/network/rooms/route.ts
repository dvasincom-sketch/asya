import { getCurrentUser } from "@/lib/auth";
import { roomDb, roomMemberDb, roomMsgDb } from "@/lib/networkDb";

export const runtime = "nodejs";

// Список моих комнат-чатов: собеседник (обезличенно), последнее сообщение, непрочитанное.
export async function GET() {
  const u = await getCurrentUser().catch(() => null);
  if (!u) return Response.json({ rooms: [] });

  const myMemberships = await roomMemberDb().findMany({ where: { userId: u.id }, take: 100 }).catch(() => []);
  const rooms = [];
  for (const m of myMemberships) {
    const room = await roomDb().findUnique({ where: { id: m.roomId } }).catch(() => null);
    if (!room || room.status !== "active") continue;
    const last = (await roomMsgDb().findMany({ where: { roomId: room.id }, orderBy: { createdAt: "desc" }, take: 1 }).catch(() => []))[0] || null;
    const unread = await roomMsgDb()
      .count({ where: { roomId: room.id, createdAt: { gt: m.lastReadAt }, NOT: { senderId: u.id } } })
      .catch(() => 0);
    rooms.push({
      id: room.id,
      asyaPresent: room.asyaPresent,
      last: last ? { sender: last.sender, kind: last.kind, content: last.content.slice(0, 80), at: last.createdAt } : null,
      unread,
    });
  }
  rooms.sort((a, b) => {
    const ta = a.last ? new Date(a.last.at).getTime() : 0;
    const tb = b.last ? new Date(b.last.at).getTime() : 0;
    return tb - ta;
  });
  return Response.json({ rooms });
}
