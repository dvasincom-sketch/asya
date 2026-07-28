import { NextRequest } from "next/server";
import { verifyOtp } from "@/lib/otp";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { phone, code } = (await req.json().catch(() => ({}))) as { phone?: string; code?: string };
  if (!phone || !code) return Response.json({ error: "bad_request" }, { status: 400 });

  const p = normalizePhone(phone);
  const ok = await verifyOtp(p, String(code));
  if (!ok) return Response.json({ error: "invalid_code", text: "Код неверный или истёк." }, { status: 401 });

  const user = await prisma.user.upsert({ where: { phone: p }, update: {}, create: { phone: p } });
  await createSession(user.id);
  return Response.json({ ok: true });
}
