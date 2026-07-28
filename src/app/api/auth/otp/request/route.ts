import { NextRequest } from "next/server";
import { issueOtp } from "@/lib/otp";
import { sendSms } from "@/lib/sms";
import { normalizePhone } from "@/lib/phone";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { phone } = (await req.json().catch(() => ({}))) as { phone?: string };
  if (!phone) return Response.json({ error: "no_phone", text: "Укажи номер телефона." }, { status: 400 });

  const p = normalizePhone(phone);
  const code = await issueOtp(p);
  const delivered = await sendSms(p, `Ася: код входа ${code}`);

  // delivered=false в разработке (код виден в логе сервера) — поток не блокируем.
  return Response.json({ ok: true, delivered });
}
