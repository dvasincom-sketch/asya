import { NextRequest } from "next/server";
import { listChatConfigs, updateChatConfig } from "@/lib/communityConfig";

export const runtime = "nodejs";

function authed(req: NextRequest): boolean {
  const key = process.env.ADMIN_KEY;
  return Boolean(key) && req.nextUrl.searchParams.get("key") === key;
}

export async function GET(req: NextRequest) {
  if (!authed(req)) return Response.json({ error: "auth" }, { status: 401 });
  return Response.json({ chats: await listChatConfigs() });
}

export async function POST(req: NextRequest) {
  if (!authed(req)) return Response.json({ error: "auth" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!b.chatId) return Response.json({ error: "chatId" }, { status: 400 });
  const updated = await updateChatConfig(String(b.chatId), b);
  return Response.json({ ok: Boolean(updated), chat: updated });
}
