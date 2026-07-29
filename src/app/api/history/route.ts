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
