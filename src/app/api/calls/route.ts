import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type CallDb = {
  findMany: (a: unknown) => Promise<unknown[]>;
  count: (a: unknown) => Promise<number>;
  updateMany: (a: unknown) => Promise<unknown>;
};

export async function GET() {
  const u = await getCurrentUser().catch(() => null);
  if (!u) return Response.json({ calls: [], unread: 0 });
  const callDb = (prisma as unknown as { call: CallDb }).call;
  const calls = await callDb.findMany({ where: { userId: u.id }, orderBy: { startedAt: "desc" }, take: 100 }).catch(() => []);
  const unread = await callDb.count({ where: { userId: u.id, handled: false } }).catch(() => 0);
  return Response.json({ calls, unread });
}

export async function POST(req: Request) {
  const u = await getCurrentUser().catch(() => null);
  if (!u) return Response.json({ error: "auth" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { markAllRead?: boolean; id?: string };
  const callDb = (prisma as unknown as { call: CallDb }).call;
  if (body.markAllRead) {
    await callDb.updateMany({ where: { userId: u.id, handled: false }, data: { handled: true } }).catch(() => {});
  } else if (body.id) {
    await callDb.updateMany({ where: { id: String(body.id), userId: u.id }, data: { handled: true } }).catch(() => {});
  }
  return Response.json({ ok: true });
}
