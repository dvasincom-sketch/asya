import { NextRequest } from "next/server";
import { listChatConfigs, updateChatConfig, seedEnvChats } from "@/lib/communityConfig";
import { listSpaces } from "@/lib/knowledge";
import { tgGetChat } from "@/lib/tgbot";

export const runtime = "nodejs";

function authed(req: NextRequest): boolean {
  const key = process.env.ADMIN_KEY;
  return Boolean(key) && req.nextUrl.searchParams.get("key") === key;
}

export async function GET(req: NextRequest) {
  if (!authed(req)) return Response.json({ error: "auth" }, { status: 401 });
  const seed = await seedEnvChats();
  const chats = await listChatConfigs();
  // Подтягиваем названия чатов из Telegram, если их ещё нет.
  for (const c of chats) {
    if (!c.title) {
      const info = await tgGetChat(c.chatId).catch(() => null);
      if (info?.title) { await updateChatConfig(c.chatId, { title: info.title }); c.title = info.title; }
    }
  }
  const spaces = await listSpaces();
  return Response.json({ chats, spaces, seededFrom: seed.seeded, seedError: seed.error });
}

export async function POST(req: NextRequest) {
  if (!authed(req)) return Response.json({ error: "auth" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!b.chatId) return Response.json({ error: "chatId" }, { status: 400 });
  const updated = await updateChatConfig(String(b.chatId), b);
  return Response.json({ ok: Boolean(updated), chat: updated });
}
