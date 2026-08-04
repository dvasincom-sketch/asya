import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const u = (await getCurrentUser()) as
    | ({ id: string; tgId: bigint | null; phone: string | null; firstName?: string | null; photoUrl?: string | null })
    | null;
  return Response.json({
    user: u
      ? {
          id: u.id,
          tgId: u.tgId ? String(u.tgId) : null,
          phone: u.phone,
          name: u.firstName || null,
          avatarUrl: u.photoUrl || null,
        }
      : null,
  });
}
