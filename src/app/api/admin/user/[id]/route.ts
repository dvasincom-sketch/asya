import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Переписка одного пользователя для панели (по ключу). Только сохранённая история —
// инкогнито зашифровано ключом устройства и НЕ расшифровывается на сервере (лишь счётчик).
const MAX = 500;

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const key = process.env.ADMIN_KEY;
  if (!key) return Response.json({ error: "ADMIN_KEY не задан." }, { status: 503 });
  if (req.nextUrl.searchParams.get("key") !== key) {
    return Response.json({ error: "Неверный ключ." }, { status: 401 });
  }
  const id = params.id;

  const user = await prisma.user
    .findUnique({ where: { id }, select: { id: true, tgId: true, phone: true, createdAt: true } })
    .catch(() => null);
  if (!user) return Response.json({ error: "not_found" }, { status: 404 });

  // Каст: песочный Prisma-клиент отстаёт по полю skill на Message.
  const msgDelegate = prisma.message as unknown as {
    findMany: (a: {
      where: { userId: string };
      orderBy: { createdAt: "asc" };
      take: number;
      select: { role: true; content: true; skill: true; createdAt: true };
    }) => Promise<{ role: string; content: string; skill: string | null; createdAt: Date }[]>;
  };

  const [rows, incognito] = await Promise.all([
    msgDelegate
      .findMany({ where: { userId: id }, orderBy: { createdAt: "asc" }, take: MAX, select: { role: true, content: true, skill: true, createdAt: true } })
      .catch(() => [] as { role: string; content: string; skill: string | null; createdAt: Date }[]),
    (prisma as unknown as { privateMessage: { count: (a: { where: { userId: string } }) => Promise<number> } }).privateMessage
      .count({ where: { userId: id } })
      .catch(() => 0),
  ]);

  const label = user.tgId
    ? `TG …${String(user.tgId).slice(-4)}`
    : user.phone
      ? `тел …${user.phone.slice(-4)}`
      : `id …${user.id.slice(-4)}`;

  return Response.json({
    profile: {
      label,
      authVia: user.tgId ? "tg" : user.phone ? "phone" : "—",
      joinedAt: user.createdAt,
      messages: rows.length,
      incognito, // только количество — контент зашифрован
    },
    messages: rows.map((m) => ({ role: m.role, content: m.content, skill: m.skill, at: m.createdAt })),
    truncated: rows.length >= MAX,
  });
}
