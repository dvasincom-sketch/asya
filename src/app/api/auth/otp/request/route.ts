import { NextRequest } from "next/server";
import { issueOtp } from "@/lib/otp";
import { sendSms } from "@/lib/sms";
import { normalizePhone } from "@/lib/phone";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { phone } = (await req.json().catch(() => ({}))) as { phone?: string };
  if (!phone) return Response.json({ error: "no_phone", text: "Укажи номер телефона." }, { status: 400 });

  const p = normalizePhone(phone);
  try {
    const code = await issueOtp(p);
    const sms = await sendSms(p, `Ася: код входа ${code}`);
    const delivered = sms.ok;
    // Если SMS не настроен (локальная разработка) — вернём код прямо в ответе,
    // чтобы можно было войти без реальной отправки. В проде с SMS_API_ID этого не происходит.
    const devCode = process.env.SMS_API_ID ? undefined : code;
    if (process.env.SMS_API_ID && !delivered) console.warn(`[otp/request] SMS не доставлено: ${sms.reason}`);
    return Response.json({ ok: true, delivered, devCode, reason: sms.reason });
  } catch (e) {
    console.error(
      "[otp/request] Ошибка записи кода. Обычно это значит, что база данных не настроена:\n" +
        "  1) подними PostgreSQL, 2) задай DATABASE_URL в .env, 3) выполни `npm run prisma:migrate`.\n",
      e,
    );
    return Response.json(
      { error: "db", text: "Пока не получается отправить код — не настроена база данных (DATABASE_URL + prisma migrate)." },
      { status: 500 },
    );
  }
}
