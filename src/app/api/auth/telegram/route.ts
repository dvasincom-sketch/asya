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
  const user = await prisma.user.upsert({ where: { tgId }, update: {}, create: { tgId } });
  await createSession(user.id);
  return Response.json({ ok: true });
}
