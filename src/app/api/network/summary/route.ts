import { getCurrentUser } from "@/lib/auth";
import { introsDb } from "@/lib/networkDb";

export const runtime = "nodejs";

// Лёгкий счётчик «твой ход» для бейджа в чате: сколько интро ждут действия человека.
//  - входящие, где ты кандидат и статус proposed (нужно откликнуться)
//  - исходящие, где ты заказчик и кандидат уже согласился (нужно выбрать)
export async function GET() {
  const u = await getCurrentUser().catch(() => null);
  if (!u) return Response.json({ count: 0 });
  const [incoming, toSelect] = await Promise.all([
    introsDb().findMany({ where: { candidateId: u.id, status: "proposed" }, take: 100 }).catch(() => []),
    introsDb().findMany({ where: { requesterId: u.id, status: "candidate_accepted" }, take: 100 }).catch(() => []),
  ]);
  return Response.json({ count: incoming.length + toSelect.length });
}
