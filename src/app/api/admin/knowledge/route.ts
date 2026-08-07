import { NextRequest } from "next/server";
import { listArticles, upsertArticle, deleteArticle } from "@/lib/knowledge";

export const runtime = "nodejs";

function authed(req: NextRequest): boolean {
  const key = process.env.ADMIN_KEY;
  return Boolean(key) && req.nextUrl.searchParams.get("key") === key;
}

export async function GET(req: NextRequest) {
  if (!authed(req)) return Response.json({ error: "auth" }, { status: 401 });
  const space = req.nextUrl.searchParams.get("space") || undefined;
  return Response.json({ articles: await listArticles(space) });
}

export async function POST(req: NextRequest) {
  if (!authed(req)) return Response.json({ error: "auth" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { id?: string; space?: string; title?: string; body?: string };
  if (!b.title || !b.body) return Response.json({ error: "title и body обязательны" }, { status: 400 });
  const a = await upsertArticle({ id: b.id, space: b.space || "default", title: b.title, body: b.body });
  return Response.json({ ok: Boolean(a), article: a });
}

export async function DELETE(req: NextRequest) {
  if (!authed(req)) return Response.json({ error: "auth" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return Response.json({ error: "id" }, { status: 400 });
  return Response.json({ ok: await deleteArticle(id) });
}
