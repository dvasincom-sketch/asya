import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const u = await getCurrentUser();
  return Response.json({
    user: u ? { id: u.id, tgId: u.tgId ? String(u.tgId) : null, phone: u.phone } : null,
  });
}
