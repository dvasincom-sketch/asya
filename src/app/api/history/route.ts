import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Возвращает последние сообщения вошедшего пользователя, если история включена.
// Одна большая лента без пользовательских чатов: по умолчанию отдаём свежее окно,
// а старое подтягивается страницами по курсору (?before=<createdAt>). Так история не пухнет.
const PAGE = 40;

export async function GET(req: Request) {
  const user = await getCurrentUser().catch(() => null);
  if (!user || !user.historyEnabled) return Response.json({ messages: [], hasMore: false, cursor: null });

  const url = new URL(req.url);
  // История своя на каждый навык: ?skill=nutri вернёт переписку навыка, без параметра — обычный чат.
  const skill = url.searchParams.get("skill");
  const before = url.searchParams.get("before"); // курсор: грузим то, что старше этой отметки

  type Where = { userId: string; skill: string | null; createdAt?: { lt: Date } };
  const msgDb = prisma.message as unknown as {
    findMany: (a: {
      where: Where;
      orderBy: { createdAt: "desc" };
      take: number;
    }) => Promise<{ role: string; content: string; createdAt: Date }[]>;
  };

  const where: Where = { userId: user.id, skill: skill ?? null };
  if (before) {
    const d = new Date(before);
    if (!isNaN(d.getTime())) where.createdAt = { lt: d };
  }

  // Берём на одну запись больше страницы, чтобы понять, есть ли ещё старое.
  const rows = await msgDb
    .findMany({ where, orderBy: { createdAt: "desc" }, take: PAGE + 1 })
    .catch(() => [] as { role: string; content: string; createdAt: Date }[]);

  const hasMore = rows.length > PAGE;
  const page = rows.slice(0, PAGE).reverse(); // от старых к новым — как показываем

  return Response.json({
    messages: page.map((r) => ({ role: r.role, content: r.content, at: r.createdAt })),
    hasMore,
    cursor: page.length ? page[0].createdAt : null, // самое старое в этой странице — курсор для «более раннего»
  });
}

// Удалить всю историю разговоров пользователя.
export async function DELETE() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return Response.json({ error: "auth" }, { status: 401 });
  await prisma.message.deleteMany({ where: { userId: user.id } }).catch(() => {});
  return Response.json({ ok: true });
}
