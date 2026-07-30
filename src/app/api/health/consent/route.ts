import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { healthDb, type HealthUser } from "@/lib/healthDb";
import { LEGAL } from "@/lib/legal";

export const runtime = "nodejs";

// Состояние согласия на медданные. Это особая категория ПД — согласие отдельное.
export async function GET() {
  const u = (await getCurrentUser().catch(() => null)) as (HealthUser & { id: string }) | null;
  if (!u) return Response.json({ user: null, enabled: false, version: LEGAL.version });
  return Response.json({
    user: { id: u.id },
    enabled: Boolean(u.healthEnabled),
    consentAt: u.healthConsentAt ?? null,
    version: LEGAL.version,
    needsConsent: !u.healthEnabled || u.healthConsentVer !== LEGAL.version,
  });
}

// Дать согласие или отозвать его.
export async function POST(req: NextRequest) {
  const u = await getCurrentUser().catch(() => null);
  if (!u) return Response.json({ error: "auth", text: "Нужно войти." }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  // Отзыв согласия: медданные больше не собираем. Удалять их сразу не будем —
  // это отдельное осознанное действие в настройках.
  if (body.enabled === false) {
    await healthDb.user().update({ where: { id: u.id }, data: { healthEnabled: false } }).catch(() => {});
    return Response.json({ ok: true, enabled: false });
  }

  if (body.confirm !== true) {
    return Response.json({ error: "not_confirmed", text: "Нужно подтвердить согласие." }, { status: 400 });
  }

  const now = new Date();
  await healthDb.user()
    .update({
      where: { id: u.id },
      data: { healthEnabled: true, healthConsentAt: now, healthConsentVer: LEGAL.version },
    })
    .catch(() => {});

  // Отдельная запись в журнале согласий — видно, на что именно человек согласился.
  await prisma.consent
    .create({ data: { userId: u.id, type: "health_data", version: LEGAL.version } })
    .catch(() => {});

  return Response.json({ ok: true, enabled: true, consentAt: now });
}
