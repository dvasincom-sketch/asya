import { NextRequest } from "next/server";
import crypto from "crypto";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkAndCount } from "@/lib/ratelimit";
import { synthesize, voiceKey } from "@/lib/elevenlabs";

export const runtime = "nodejs";

const MAX_CHARS = 800;
const DAILY = Number(process.env.VOICE_DAILY_LIMIT || 15); // лимит генераций на человека в день

type ClipDelegate = {
  findUnique: (a: { where: { hash: string } }) => Promise<{ audio: Uint8Array } | null>;
  create: (a: { data: { hash: string; audio: Buffer; chars: number } }) => Promise<unknown>;
};
function clipDb(): ClipDelegate {
  return (prisma as unknown as { voiceClip: ClipDelegate }).voiceClip;
}

function audioResponse(bytes: Uint8Array): Response {
  return new Response(Buffer.from(bytes), {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=86400" },
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return Response.json({ error: "auth" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const text = String(b.text || "").trim().slice(0, MAX_CHARS);
  if (text.length < 1) return Response.json({ error: "empty" }, { status: 400 });

  const hash = crypto.createHash("sha256").update(`${voiceKey()}:${text}`).digest("hex");

  // Кеш: повтор той же реплики — бесплатно и мгновенно, лимит не тратим.
  const cached = await clipDb().findUnique({ where: { hash } }).catch(() => null);
  if (cached?.audio) return audioResponse(cached.audio);

  // Лимит на генерацию (по человеку в день) — только на новый синтез.
  const day = new Date().toISOString().slice(0, 10);
  const { allowed } = await checkAndCount(`voice:${user.id}:${day}`, DAILY);
  if (!allowed) {
    return Response.json({ error: "limit", text: "На сегодня достаточно озвучки 🤍 Вернёмся к этому завтра." }, { status: 429 });
  }

  const res = await synthesize(text);
  if (!res.ok) {
    return Response.json({ error: "unavailable", reason: res.reason, text: "Голос сейчас недоступен, попробуй чуть позже." }, { status: 503 });
  }

  await clipDb().create({ data: { hash, audio: res.audio, chars: text.length } }).catch(() => {});
  return audioResponse(res.audio);
}
