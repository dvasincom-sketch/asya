import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Возвращает последние сообщения вошедшего пользователя, если история включена.
export async function GET(req: Request) {
  const user = await getCurrentUser().catch(() => null);
  if (!user || !user.historyEnabled) return Response.json({ messages: [] });

  // История своя на каждый навык: ?skill=nutri вернёт переписку навыка, без параметра — обычный чат.
  const skill = new URL(req.url).searchParams.get("skill");

  const msgDb = prisma.message as unknown as {
    findMany: (a: {
      where: { userId: string; skill: string | null };
      orderBy: { createdAt: "desc" };
      take: number;
    }) => Promise<{ role: string; content: string }[]>;
  };
  const rows = await msgDb
    .findMany({ where: { userId: user.id, skill: skill ?? null }, orderBy: { createdAt: "desc" }, take: 100 })
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
