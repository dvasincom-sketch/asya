import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { roomDb, roomMemberDb, roomMsgDb } from "@/lib/networkDb";
import { ASYA_FAREWELL } from "@/lib/rooms";

export const runtime = "nodejs";

// Голос за то, чтобы убрать Асю из чата (приватность). Когда ОБА участника — за, Ася выходит.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const u = await getCurrentUser().catch(() => null);
  if (!u) return Response.json({ error: "auth" }, { status: 401 });
  const roomId = params.id;
  const me = await roomMemberDb().findUnique({ where: { roomId_userId: { roomId, userId: u.id } } }).catch(() => null);
  if (!me) return Response.json({ error: "forbidden" }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const remove = b.remove !== false; // по умолчанию — за удаление; передать {remove:false} чтобы отозвать
  await roomMemberDb().update({ where: { roomId_userId: { roomId, userId: u.id } }, data: { removeAsya: remove } }).catch(() => {});

  const members = await roomMemberDb().findMany({ where: { roomId } }).catch(() => []);
  const allWantOut = members.length >= 2 && members.every((m) => m.removeAsya);

  const room = await roomDb().findUnique({ where: { id: roomId } }).catch(() => null);
  if (allWantOut && room?.asyaPresent) {
    await roomDb().update({ where: { id: roomId }, data: { asyaPresent: false } }).catch(() => {});
    await roomMsgDb().create({ data: { roomId, sender: "asya", senderId: null, kind: "system", content: ASYA_FAREWELL } }).catch(() => {});
    return Response.json({ ok: true, asyaPresent: false });
  }
  return Response.json({ ok: true, asyaPresent: room?.asyaPresent ?? true, waitingOther: remove && !allWantOut });
}
