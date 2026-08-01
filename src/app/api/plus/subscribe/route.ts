import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { plusConfigured, getSub, hasPlus, yooCreateCheckout, markPending } from "@/lib/plus";

export const runtime = "nodejs";

// Оформление: создаём платёж YooKassa с сохранением карты и возвращаем ссылку на оплату.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return Response.json({ error: "auth" }, { status: 401 });
  if (!plusConfigured()) {
    return Response.json({ error: "not_configured", text: "Оплата скоро будет доступна." }, { status: 503 });
  }
  const sub = await getSub(user.id);
  if (hasPlus(sub)) return Response.json({ already: true });

  const base = (process.env.PUBLIC_BASE_URL || req.nextUrl.origin).replace(/\/$/, "");
  const payment = await yooCreateCheckout(user.id, `${base}/account/plus`);
  const url = payment?.confirmation?.confirmation_url;
  if (!url) {
    return Response.json({ error: "payment_failed", text: "Не получилось создать платёж. Попробуй ещё раз." }, { status: 502 });
  }
  await markPending(user.id);
  return Response.json({ url });
}
