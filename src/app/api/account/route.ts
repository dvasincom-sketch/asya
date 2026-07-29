import { getCurrentUser, destroySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Полное удаление аккаунта: профиль, память, история, сессии (каскадом).
export async function DELETE() {
  const u = await getCurrentUser().catch(() => null);
  if (!u) return Response.json({ error: "auth" }, { status: 401 });

  await prisma.user.delete({ where: { id: u.id } }).catch(() => {});
  await destroySession().catch(() => {});
  return Response.json({ ok: true });
}
