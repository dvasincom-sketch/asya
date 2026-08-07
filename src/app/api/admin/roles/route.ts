import { NextRequest } from "next/server";
import { listRoles, upsertRole, CAP_LABELS, type Caps } from "@/lib/roles";

export const runtime = "nodejs";

function authed(req: NextRequest): boolean {
  const key = process.env.ADMIN_KEY;
  return Boolean(key) && req.nextUrl.searchParams.get("key") === key;
}

export async function GET(req: NextRequest) {
  if (!authed(req)) return Response.json({ error: "auth" }, { status: 401 });
  return Response.json({ roles: await listRoles(), caps: CAP_LABELS });
}

export async function POST(req: NextRequest) {
  if (!authed(req)) return Response.json({ error: "auth" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { key?: string; title?: string; caps?: Caps; builtin?: boolean };
  if (!b.key || !b.title) return Response.json({ error: "key и title обязательны" }, { status: 400 });
  const caps: Caps = { support: Boolean(b.caps?.support), moderation: Boolean(b.caps?.moderation), captcha: Boolean(b.caps?.captcha) };
  const role = await upsertRole({ key: b.key, title: b.title, caps, builtin: b.builtin });
  return Response.json({ ok: Boolean(role), role });
}
