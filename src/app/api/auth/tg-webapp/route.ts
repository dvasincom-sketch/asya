import { NextRequest } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";

export const runtime = "nodejs";

// Проверка подписи Telegram Mini App (initData).
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
function verifyInitData(initData: string, botToken: string): { ok: boolean; userId?: number } {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { ok: false };
  params.delete("hash");

  const dataCheck = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");

  const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const calc = crypto.createHmac("sha256", secret).update(dataCheck).digest("hex");
  if (calc !== hash) return { ok: false };

  // Свежесть: не старше суток.
  const authDate = Number(params.get("auth_date") || 0);
  if (!authDate || Date.now() / 1000 - authDate > 86400) return { ok: false };

  try {
    const user = JSON.parse(params.get("user") || "null");
    if (!user?.id) return { ok: false };
    return { ok: true, userId: Number(user.id) };
  } catch {
    return { ok: false };
  }
}

export async function POST(req: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return Response.json({ error: "config" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const initData = String(body.initData || "");
  if (!initData) return Response.json({ error: "no_init" }, { status: 400 });

  const v = verifyInitData(initData, token);
  if (!v.ok || !v.userId) return Response.json({ error: "bad_init" }, { status: 401 });

  const tgId = BigInt(v.userId);
  const user = await prisma.user.upsert({ where: { tgId }, update: {}, create: { tgId } });
  await createSession(user.id);
  return Response.json({ ok: true });
}
