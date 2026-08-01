import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Текущие настройки приватности + то, что Ася помнит.
export async function GET() {
  const u = await getCurrentUser().catch(() => null);
  if (!u) return Response.json({ user: null });

  const memories = await prisma.memory
    .findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, take: 100 })
    .catch(() => [] as { id: string; fact: string }[]);

  return Response.json({
    user: {
      memoryEnabled: u.memoryEnabled,
      historyEnabled: u.historyEnabled,
      remindersEnabled: u.remindersEnabled,
      reminderCadence: (u as unknown as { reminderCadence?: string | null }).reminderCadence || "rare",
      healthEnabled: Boolean((u as unknown as { healthEnabled?: boolean }).healthEnabled),
    },
    memories: memories.map((m: { id: string; fact: string }) => ({ id: m.id, fact: m.fact })),
  });
}

// Обновление переключателей приватности.
export async function PATCH(req: NextRequest) {
  const u = await getCurrentUser().catch(() => null);
  if (!u) return Response.json({ error: "auth" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  for (const k of ["memoryEnabled", "historyEnabled", "remindersEnabled"] as const) {
    if (typeof body[k] === "boolean") data[k] = body[k];
  }
  if (typeof body.reminderCadence === "string" && ["rare", "weekly", "often"].includes(body.reminderCadence)) {
    data.reminderCadence = body.reminderCadence;
  }
  if (Object.keys(data).length) {
    await (
      prisma.user as unknown as {
        update: (a: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
      }
    )
      .update({ where: { id: u.id }, data })
      .catch(() => {});
  }
  return Response.json({ ok: true });
}
