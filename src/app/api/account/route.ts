import { getCurrentUser, destroySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Мягкое удаление: аккаунт уходит в архив (archivedAt). Данные остаются ещё 30 дней —
// при повторном входе (тем же Telegram/номером) аккаунт восстанавливается. Полное удаление
// архивных аккаунтов выполняет отдельная фоновая чистка по прошествии срока.
export async function DELETE() {
  const u = await getCurrentUser().catch(() => null);
  if (!u) return Response.json({ error: "auth" }, { status: 401 });

  await prisma.user.update({ where: { id: u.id }, data: { archivedAt: new Date() } as never }).catch(() => {});
  await destroySession().catch(() => {});
  return Response.json({ ok: true, archivedUntilDays: 30 });
}
