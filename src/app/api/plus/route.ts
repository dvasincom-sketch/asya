import { getCurrentUser } from "@/lib/auth";
import { getSub, hasPlus, plusUntil, plusConfigured, PLUS_AMOUNT } from "@/lib/plus";

export const runtime = "nodejs";

// Текущий статус «Забота+» для экрана тарифа и настроек.
export async function GET() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return Response.json({ plus: false, configured: plusConfigured(), price: PLUS_AMOUNT });
  const sub = await getSub(user.id);
  const until = plusUntil(sub);
  return Response.json({
    plus: hasPlus(sub),
    status: sub?.status ?? null,
    canceled: sub?.status === "canceled",
    until: until ? until.toISOString() : null,
    configured: plusConfigured(),
    price: PLUS_AMOUNT,
  });
}
