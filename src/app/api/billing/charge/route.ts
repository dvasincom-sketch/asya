import { NextRequest } from "next/server";
import { dueSubs, yooChargeSaved, extendSub, markPastDue, plusConfigured } from "@/lib/plus";

export const runtime = "nodejs";

// Продление по крону:
//   GET https://<домен>/api/billing/charge?key=<CRON_SECRET или TELEGRAM_WEBHOOK_SECRET>
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  const secret = process.env.CRON_SECRET || process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || key !== secret) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (!plusConfigured()) return Response.json({ ok: true, skipped: "not_configured" });

  const now = new Date();
  const subs = await dueSubs(now, 50);
  let charged = 0;
  let failed = 0;
  for (const s of subs) {
    if (!s.externalId) continue;
    const p = await yooChargeSaved(s.userId, s.externalId);
    if (p && (p.status === "succeeded" || p.paid)) {
      await extendSub(s.userId);
      charged += 1;
    } else {
      await markPastDue(s.userId);
      failed += 1;
    }
  }
  return Response.json({ ok: true, checked: subs.length, charged, failed });
}
