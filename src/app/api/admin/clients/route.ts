import { NextRequest } from "next/server";
import { listClients, createClient, updateClient, deleteClient } from "@/lib/apiClients";

export const runtime = "nodejs";

function authed(req: NextRequest): boolean {
  const key = process.env.ADMIN_KEY;
  return Boolean(key) && req.nextUrl.searchParams.get("key") === key;
}

export async function GET(req: NextRequest) {
  if (!authed(req)) return Response.json({ error: "auth" }, { status: 401 });
  const raw = process.env.SUMMARY_API_KEY || "";
  const legacy = raw.split(",").map((s) => s.trim()).filter(Boolean).map((k) => ({ masked: `${k.slice(0, 6)}\u2022\u2022\u2022\u2022${k.slice(-4)}` }));
  return Response.json({ clients: await listClients(), legacy });
}

export async function DELETE(req: NextRequest) {
  if (!authed(req)) return Response.json({ error: "auth" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return Response.json({ error: "id" }, { status: 400 });
  return Response.json({ ok: await deleteClient(id) });
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
