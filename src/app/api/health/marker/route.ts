import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { healthDb, type HealthUser, type MarkerRow } from "@/lib/healthDb";
import { markerLabel } from "@/lib/healthMarkers";

export const runtime = "nodejs";

// История одного показателя: динамика за все годы, по фактам документов.
export async function GET(req: NextRequest) {
  const user = (await getCurrentUser().catch(() => null)) as (HealthUser & { id: string }) | null;
  if (!user) return Response.json({ error: "auth" }, { status: 401 });
  if (!user.healthEnabled) return Response.json({ error: "no_consent" }, { status: 403 });

  const code = (req.nextUrl.searchParams.get("code") || "").trim();
  if (!code) return Response.json({ error: "bad_request" }, { status: 400 });

  const rows = await healthDb.marker()
    .findMany({ where: { userId: user.id, code }, orderBy: [{ takenAt: "asc" }, { createdAt: "asc" }], take: 200 })
    .catch(() => [] as MarkerRow[]);

  if (!rows.length) return Response.json({ code, name: code, points: [] });

  const last = rows[rows.length - 1];
  return Response.json({
    code,
    name: markerLabel(code, last.name),
    unit: last.unit,
    refText: last.refText,
    refLow: last.refLow,
    refHigh: last.refHigh,
    points: rows.map((r) => ({
      value: r.value,
      valueText: r.valueText,
      takenAt: r.takenAt,
      flag: r.flag,
      refText: r.refText,
      unit: r.unit,
    })),
  });
}
