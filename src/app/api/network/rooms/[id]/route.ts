import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { roomDb, roomMemberDb, roomMsgDb, type RoomMessageRow } from "@/lib/networkDb";
import { detectOffPlatform, ASYA_WARN } from "@/lib/rooms";
import { complete, hasKey } from "@/lib/timeweb";
import { clean } from "@/lib/text";

export const runtime = "nodejs";

async function member(roomId: string, userId: string) {
  return roomMemberDb().findUnique({ where: { roomId_userId: { roomId, userId } } }).catch(() => null);
}

// GET: сообщения комнаты + мета (Ася в чате? голоса на её удаление). Помечает прочитанным.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const u = await getCurrentUser().catch(() => null);
  if (!u) return Response.json({ error: "auth" }, { status: 401 });
  const roomId = params.id;
  const me = await member(roomId, u.id);
  if (!me) return Response.json({ error: "forbidden" }, { status: 403 });

  const room = await roomDb().findUnique({ where: { id: roomId } }).catch(() => null);
  if (!room) return Response.json({ error: "not_found" }, { status: 404 });

  const members = await roomMemberDb().findMany({ where: { roomId } }).catch(() => []);
  const other = members.find((m) => m.userId !== u.id);
  const msgs = await roomMsgDb().findMany({ where: { roomId }, orderBy: { createdAt: "asc" }, take: 200 }).catch(() => []);

  await roomMemberDb().update({ where: { roomId_userId: { roomId, userId: u.id } }, data: { lastReadAt: new Date() } }).catch(() => {});

  return Response.json({
    asyaPresent: room.asyaPresent,
    iVotedRemove: me.removeAsya,
    otherVotedRemove: other?.removeAsya ?? false,
    messages: msgs.map((m) => ({ id: m.id, mine: m.senderId === u.id, sender: m.sender, kind: m.kind, content: m.content, at: m.createdAt })),
  });
}

// POST: отправить сообщение. Модерация: при попытке увести со стороны — Ася бережно
// предупреждает (сообщение всё равно проходит). Если обратились к Асе — помогает.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const u = await getCurrentUser().catch(() => null);
  if (!u) return Response.json({ error: "auth" }, { status: 401 });
  const roomId = params.id;
  const me = await member(roomId, u.id);
  if (!me) return Response.json({ error: "forbidden" }, { status: 403 });

  const room = await roomDb().findUnique({ where: { id: roomId } }).catch(() => null);
  if (!room || room.status !== "active") return Response.json({ error: "closed" }, { status: 400 });

  const b = await req.json().catch(() => ({}));
  const content = String(b.content || "").trim().slice(0, 2000);
  if (!content) return Response.json({ error: "empty" }, { status: 400 });

  await roomMsgDb().create({ data: { roomId, sender: "user", senderId: u.id, kind: "text", content } }).catch(() => {});

  const appended: { sender: string; kind: string; content: string }[] = [];

  if (room.asyaPresent) {
    // Мягкое удержание — предупреждаем, но не блокируем.
    if (detectOffPlatform(content)) {
      const warn = await roomMsgDb().create({ data: { roomId, sender: "asya", senderId: null, kind: "warn", content: ASYA_WARN } }).catch(() => null);
      if (warn) appended.push({ sender: "asya", kind: "warn", content: ASYA_WARN });
    }
    // Обратились к Асе — помогает как нейтральная сторона.
    else if (/(^|[\s,.])ася\b/i.test(content) && hasKey()) {
      const sys =
        "Ты — Ася, тёплая непредвзятая помощница в общем чате двух людей (услуга или знакомство). Тебя позвали в разговор. " +
        "Ответь ОДНОЙ короткой доброй фразой по существу, ничью сторону не занимай, ничего не продавай, без списков и разметки. " +
        "Если уместно — мягко напомни, что общаться спокойнее здесь.";
      const text = clean(await complete([{ role: "user", content }], sys, 160)).trim();
      if (text) {
        await roomMsgDb().create({ data: { roomId, sender: "asya", senderId: null, kind: "text", content: text } }).catch(() => {});
        appended.push({ sender: "asya", kind: "text", content: text });
      }
    }
  }

  return Response.json({ ok: true, appended });
}
