import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { listDocs, getDoc, saveDoc, deleteDoc } from "@/lib/projectDocs";

export const runtime = "nodejs";

function authed(req: NextRequest): boolean {
  const key = process.env.ADMIN_KEY;
  return Boolean(key) && req.nextUrl.searchParams.get("key") === key;
}

async function clientName(id: string): Promise<string> {
  const c = await (prisma as unknown as { apiClient: { findUnique: (a: { where: { id: string } }) => Promise<{ name: string } | null> } })
    .apiClient.findUnique({ where: { id } })
    .catch(() => null);
  return c?.name || "";
}

// Документы-контекст проекта. GET со списком (?clientId) или одним документом (&id).
export async function GET(req: NextRequest) {
  if (!authed(req)) return Response.json({ error: "auth" }, { status: 401 });
  const clientId = req.nextUrl.searchParams.get("clientId") || "";
  const id = req.nextUrl.searchParams.get("id") || "";
  if (!clientId) return Response.json({ ok: false, error: "no_client" }, { status: 400 });
  if (id) {
    const doc = await getDoc(clientId, id);
    if (!doc) return Response.json({ ok: false, error: "not_found" }, { status: 404 });
    return Response.json({ ok: true, doc });
  }
  const docs = await listDocs(clientId, await clientName(clientId));
  return Response.json({ ok: true, docs });
}

// Создать/обновить документ. Body: { clientId, id?, path, title, body }
export async function POST(req: NextRequest) {
  if (!authed(req)) return Response.json({ error: "auth" }, { status: 401 });
  const b = (await req.json().catch(() => null)) as { clientId?: string; id?: string; path?: string; title?: string; body?: string } | null;
  if (!b?.clientId) return Response.json({ ok: false, error: "no_client" }, { status: 400 });
  if (!b.id && !(b.path || "").trim()) return Response.json({ ok: false, error: "no_path", text: "Нужен путь/имя документа." }, { status: 400 });
  const doc = await saveDoc({ clientId: b.clientId, id: b.id, path: b.path || "", title: b.title || "", body: b.body || "" });
  if (!doc) return Response.json({ ok: false, error: "save_failed", text: "Не удалось сохранить (возможно, путь занят)." }, { status: 409 });
  return Response.json({ ok: true, doc });
}

// Удалить документ. ?clientId=&id=
export async function DELETE(req: NextRequest) {
  if (!authed(req)) return Response.json({ error: "auth" }, { status: 401 });
  const clientId = req.nextUrl.searchParams.get("clientId") || "";
  const id = req.nextUrl.searchParams.get("id") || "";
  if (!clientId || !id) return Response.json({ ok: false, error: "bad_request" }, { status: 400 });
  const ok = await deleteDoc(clientId, id);
  return Response.json({ ok });
}
