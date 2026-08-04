import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { explainMarker } from "@/lib/medground";

export const runtime = "nodejs";

// Общее объяснение показателя для карточки в «Здоровье». Только для вошедших с согласием на медданные.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return Response.json({ error: "auth" }, { status: 401 });
  if (!(user as unknown as { healthEnabled?: boolean }).healthEnabled) {
    return Response.json({ error: "no_consent" }, { status: 403 });
  }
  const b = await req.json().catch(() => ({}));
  const code = String(b.code || "").trim();
  const name = String(b.name || "").trim();
  const dir = String(b.dir || "general");
  if (!code || !name) return Response.json({ error: "bad_request" }, { status: 400 });

  const { text } = await explainMarker(code, name, dir);
  return Response.json({ text });
}
