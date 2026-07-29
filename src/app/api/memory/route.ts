import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Забыть один факт ({ id }) или всю память ({ all: true }).
export async function DELETE(req: NextRequest) {
  const u = await getCurrentUser().catch(() => null);
  if (!u) return Response.json({ error: "auth" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (body.all === true) {
    await prisma.memory.deleteMany({ where: { userId: u.id } }).catch(() => {});
  } else if (body.id) {
    // userId в условии — чтобы нельзя было удалить чужой факт.
    await prisma.memory.deleteMany({ where: { id: String(body.id), userId: u.id } }).catch(() => {});
  }
  return Response.json({ ok: true });
}
