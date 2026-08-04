import { NextRequest } from "next/server";
import { verifyTelegramLogin, type TgAuth } from "@/lib/telegram";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const data = (await req.json().catch(() => null)) as TgAuth | null;
  if (!token) return Response.json({ error: "config", text: "TELEGRAM_BOT_TOKEN не задан." }, { status: 503 });
  if (!data) return Response.json({ error: "bad_request" }, { status: 400 });

  if (!verifyTelegramLogin(data, token)) {
    return Response.json({ error: "bad_hash", text: "Подпись Telegram не прошла проверку." }, { status: 401 });
  }

  const tgId = BigInt(data.id);
  // Сохраняем имя и фото из Telegram — для иконки-аватара в шапке.
  const prof: { firstName?: string; photoUrl?: string } = {};
  if (data.first_name) prof.firstName = String(data.first_name).slice(0, 120);
  if (data.photo_url) prof.photoUrl = String(data.photo_url).slice(0, 500);
  const user = await prisma.user.upsert({
    where: { tgId },
    update: { ...prof, archivedAt: null } as never,
    create: { tgId, ...prof } as never,
  });
  await createSession(user.id);
  return Response.json({ ok: true });
}
