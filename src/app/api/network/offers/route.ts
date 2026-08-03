import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { offersDb, consentDb } from "@/lib/networkDb";
import { isCategory } from "@/lib/network";

export const runtime = "nodejs";

export async function GET() {
  const u = await getCurrentUser().catch(() => null);
  if (!u) return Response.json({ offers: [] });
  const rows = await offersDb().findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, take: 50 }).catch(() => []);
  return Response.json({
    offers: rows.map((o) => ({
      id: o.id, category: o.category, title: o.title,
      params: o.params ? JSON.parse(o.params) : {}, blurb: o.blurb, status: o.status,
    })),
  });
}

export async function POST(req: NextRequest) {
  const u = await getCurrentUser().catch(() => null);
  if (!u) return Response.json({ error: "auth" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const category = String(b.category || "");
  if (!isCategory(category)) return Response.json({ error: "bad_category" }, { status: 400 });

  const wantActive = b.status === "active";
  const paramsObj = b.params && typeof b.params === "object" ? b.params : {};

  // Год рождения (для 18+ в знакомствах) — сохраняем на пользователе, если пришёл.
  if (typeof b.bornYear === "number") {
    await prisma.user.update({ where: { id: u.id }, data: { bornYear: b.bornYear } as unknown as { bornYear: number } }).catch(() => {});
  }

  let status = "draft";
  if (wantActive) {
    const consents = await consentDb().findMany({ where: { userId: u.id } }).catch(() => []);
    if (!consents.some((c) => c.category === category && c.enabled)) {
      return Response.json({ error: "need_consent", text: "Сначала включи участие в этой категории." }, { status: 400 });
    }
    if (category === "dating") {
      const me = await prisma.user.findUnique({ where: { id: u.id }, select: {} }).catch(() => null);
      const by = (me as unknown as { bornYear?: number } | null)?.bornYear ?? (typeof b.bornYear === "number" ? b.bornYear : null);
      const age = by ? new Date().getFullYear() - by : 0;
      if (!by || age < 18) return Response.json({ error: "age", text: "Знакомства — только для 18+." }, { status: 400 });
    }
    status = "active";
  }

  const data = {
    userId: u.id,
    category,
    title: String(b.title || "").slice(0, 80) || "Без названия",
    params: JSON.stringify(paramsObj).slice(0, 4000),
    blurb: b.blurb ? String(b.blurb).slice(0, 500) : null,
    shareScope: b.shareScope ? JSON.stringify(b.shareScope).slice(0, 2000) : null,
    status,
  };

  const id = typeof b.id === "string" ? b.id : null;
  if (id) {
    const cur = await offersDb().findUnique({ where: { id } }).catch(() => null);
    if (!cur || cur.userId !== u.id) return Response.json({ error: "not_found" }, { status: 404 });
    await offersDb().update({ where: { id }, data }).catch(() => {});
    return Response.json({ ok: true, id });
  }
  const created = await offersDb().create({ data }).catch(() => null);
  return Response.json({ ok: Boolean(created), id: created?.id ?? null });
}

export async function DELETE(req: NextRequest) {
  const u = await getCurrentUser().catch(() => null);
  if (!u) return Response.json({ error: "auth" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const id = String(b.id || "");
  const cur = await offersDb().findUnique({ where: { id } }).catch(() => null);
  if (cur && cur.userId === u.id) await offersDb().delete({ where: { id } }).catch(() => {});
  return Response.json({ ok: true });
}
