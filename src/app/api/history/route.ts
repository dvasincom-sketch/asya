import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Возвращает последние сообщения вошедшего пользователя, если история включена.
export async function GET() {
  const user = await getCurrentUser().catch(() => null);
  if (!user || !user.historyEnabled) return Response.json({ messages: [] });

  const rows = await prisma.message
    .findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 })
    .catch(() => [] as { role: string; content: string }[]);

  return Response.json({
    messages: rows.map((r: { role: string; content: string }) => ({ role: r.role, content: r.content })).reverse(),
  });
}

// Удалить всю историю разговоров пользователя.
export async function DELETE() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return Response.json({ error: "auth" }, { status: 401 });
  await prisma.message.deleteMany({ where: { userId: user.id } }).catch(() => {});
  return Response.json({ ok: true });
}
