import { getCurrentUser } from "@/lib/auth";
import { getSub, hasPlus, plusUntil, plusConfigured, PLUS_AMOUNT } from "@/lib/plus";
import { prisma } from "@/lib/prisma";
import { LEGAL } from "@/lib/legal";

export const runtime = "nodejs";

type U = {
  id: string; tgId: bigint | null; phone: string | null;
  createdAt?: Date; firstName?: string | null; photoUrl?: string | null;
  consentAt?: Date | null; consentVersion?: string | null;
  healthConsentAt?: Date | null; healthConsentVer?: string | null;
};

export async function GET() {
  const u = (await getCurrentUser().catch(() => null)) as U | null;
  if (!u) return Response.json({ user: null });

  const sub = await getSub(u.id);
  const consents = await (prisma.consent as unknown as {
    findMany: (a: unknown) => Promise<{ type: string; version: string; grantedAt: Date }[]>;
  })
    .findMany({ where: { userId: u.id }, orderBy: { grantedAt: "desc" }, take: 50 })
    .catch(() => [] as { type: string; version: string; grantedAt: Date }[]);

  return Response.json({
    user: {
      id: u.id,
      tgId: u.tgId ? String(u.tgId) : null,
      phone: u.phone,
      name: u.firstName || null,
      avatarUrl: u.photoUrl || null,
      memberSince: u.createdAt || null,
    },
    plan: {
      active: hasPlus(sub),
      status: sub?.status || null,
      nextChargeAt: sub?.nextChargeAt || null,
      until: plusUntil(sub),
      amount: PLUS_AMOUNT,
      configured: plusConfigured(),
      hasPaymentMethod: Boolean(sub?.externalId),
    },
    consent: {
      terms: { version: u.consentVersion || null, at: u.consentAt || null },
      health: { version: u.healthConsentVer || null, at: u.healthConsentAt || null },
      records: consents.map((c) => ({ type: c.type, version: c.version, at: c.grantedAt })),
    },
    legal: { version: LEGAL.version, updated: LEGAL.updated, site: LEGAL.site, support: LEGAL.email },
  });
}
