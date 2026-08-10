import { NextRequest } from "next/server";
import { listClients, createClient, updateClient } from "@/lib/apiClients";

export const runtime = "nodejs";

function authed(req: NextRequest): boolean {
  const key = process.env.ADMIN_KEY;
  return Boolean(key) && req.nextUrl.searchParams.get("key") === key;
}

export async function GET(req: NextRequest) {
  if (!authed(req)) return Response.json({ error: "auth" }, { status: 401 });
  return Response.json({ clients: await listClients() });
}

export async function POST(req: NextRequest) {
  if (!authed(req)) return Response.json({ error: "auth" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { id?: string; name?: string; capability?: string; instruction?: string; enabled?: boolean };
  if (b.id) {
    const c = await updateClient(b.id, { name: b.name, capability: b.capability, instruction: b.instruction, enabled: b.enabled });
    return Response.json({ ok: Boolean(c), client: c });
  }
  if (!b.name) return Response.json({ error: "name" }, { status: 400 });
  const c = await createClient(b.name, b.capability || "summary", b.instruction);
  return Response.json({ ok: Boolean(c), client: c });
}
