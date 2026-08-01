import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Инкогнито-переписка: сервер хранит только зашифрованные блобы (iv + data) и не может
// их прочитать — ключ живёт только на устройстве человека. Prisma-клиент в песочнице
// собран без новой модели, поэтому идём через приведение типов.
type PMRow = { role: string; iv: string; data: string; createdAt: Date };
function pmDb() {
  return (
    prisma as unknown as {
      privateMessage: {
        create: (a: { data: { userId: string; role: string; iv: string; data: string } }) => Promise<unknown>;
        findMany: (a: { where: { userId: string }; orderBy: { createdAt: "asc" }; take: number }) => Promise<PMRow[]>;
        deleteMany: (a: { where: { userId: string } }) => Promise<unknown>;
      };
    }
  ).privateMessage;
}

// Отдать зашифрованные сообщения — расшифровать их сможет только браузер человека.
export async function GET() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return Response.json({ messages: [] });
  const rows = await pmDb()
    .findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" }, take: 200 })
    .catch(() => [] as PMRow[]);
  return Response.json({ messages: rows.map((r) => ({ role: r.role, iv: r.iv, data: r.data })) });
}

// Сохранить одно зашифрованное сообщение.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return Response.json({ error: "auth" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const role = b.role === "assistant" ? "assistant" : "user";
  const iv = typeof b.iv === "string" ? b.iv : "";
  const data = typeof b.data === "string" ? b.data : "";
  // Здравые пределы: iv короткий, шифротекст не безразмерный.
  if (!iv || iv.length > 64 || !data || data.length > 40000) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  await pmDb().create({ data: { userId: user.id, role, iv, data } }).catch(() => {});
  return Response.json({ ok: true });
}

// Стереть всю инкогнито-переписку человека.
export async function DELETE() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return Response.json({ error: "auth" }, { status: 401 });
  await pmDb().deleteMany({ where: { userId: user.id } }).catch(() => {});
  return Response.json({ ok: true });
}
