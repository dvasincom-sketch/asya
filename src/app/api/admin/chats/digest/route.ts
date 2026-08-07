import { NextRequest } from "next/server";
import { digestChat } from "@/lib/history";

export const runtime = "nodejs";

function authed(req: NextRequest): boolean {
  const key = process.env.ADMIN_KEY;
  return Boolean(key) && req.nextUrl.searchParams.get("key") === key;
}

export async function POST(req: NextRequest) {
  if (!authed(req)) return Response.json({ error: "auth" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!b.chatId) return Response.json({ error: "chatId" }, { status: 400 });
  const space = typeof b.space === "string" && b.space ? b.space : "default";
  const res = await digestChat(String(b.chatId), space);
  return Response.json(res);
}
