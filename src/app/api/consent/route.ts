import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LEGAL } from "@/lib/legal";

export const runtime = "nodejs";

// Текущее состояние согласия: нужно ли спрашивать заново (например, вышла новая редакция).
export async function GET() {
  const u = await getCurrentUser().catch(() => null);
  if (!u) return Response.json({ user: null, needsConsent: false, version: LEGAL.version });
  return Response.json({
    user: { id: u.id },
    version: LEGAL.version,
    consentAt: u.consentAt,
    consentVersion: u.consentVersion,
    needsConsent: !u.consentAt || u.consentVersion !== LEGAL.version,
  });
}

// Фиксация согласия: дата и версия в профиле + отдельная запись в журнале согласий.
export async function POST(req: NextRequest) {
  const u = await getCurrentUser().catch(() => null);
  if (!u) return Response.json({ error: "auth", text: "Нужно войти." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (body.adult !== true || body.terms !== true) {
    return Response.json({ error: "not_confirmed", text: "Нужно подтвердить согласие." }, { status: 400 });
  }

  const now = new Date();
  await prisma.user
    .update({ where: { id: u.id }, data: { consentAt: now, consentVersion: LEGAL.version } })
    .catch(() => {});

  // Журнал: отдельная запись на каждый вид согласия — так видно, на что именно человек согласился.
  await prisma.consent
    .createMany({
      data: [
        { userId: u.id, type: "terms", version: LEGAL.version },
        { userId: u.id, type: "privacy", version: LEGAL.version },
        { userId: u.id, type: "adult_18", version: LEGAL.version },
      ],
    })
    .catch(() => {});

  return Response.json({ ok: true, version: LEGAL.version, consentAt: now });
}
