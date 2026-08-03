import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { consentDb } from "@/lib/networkDb";
import { CATEGORIES, isCategory, categoryLive, type NetCategory } from "@/lib/network";

export const runtime = "nodejs";

export async function GET() {
  const u = await getCurrentUser().catch(() => null);
  const categories = (Object.keys(CATEGORIES) as NetCategory[]).map((id) => ({
    id,
    label: CATEGORIES[id].label,
    icon: CATEGORIES[id].icon,
    live: categoryLive(id),
    note: CATEGORIES[id].note,
  }));
  if (!u) return Response.json({ categories, consents: {} });
  const rows = await consentDb().findMany({ where: { userId: u.id } }).catch(() => []);
  const consents: Record<string, boolean> = {};
  for (const r of rows) consents[r.category] = r.enabled;
  return Response.json({ categories, consents });
}

export async function POST(req: NextRequest) {
  const u = await getCurrentUser().catch(() => null);
  if (!u) return Response.json({ error: "auth" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const category = String(b.category || "");
  if (!isCategory(category)) return Response.json({ error: "bad_category" }, { status: 400 });
  const enabled = b.enabled === true;
  await consentDb()
    .upsert({
      where: { userId_category: { userId: u.id, category } },
      create: { userId: u.id, category, enabled },
      update: { enabled },
    })
    .catch(() => {});
  return Response.json({ ok: true });
}
