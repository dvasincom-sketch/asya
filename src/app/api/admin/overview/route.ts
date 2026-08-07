import { NextRequest } from "next/server";
import { listChatConfigs } from "@/lib/communityConfig";
import { listArticles, listSpaces, sectionCounts } from "@/lib/knowledge";
import { totalStoredMessages, totalFromBot } from "@/lib/history";
import { capsForChat, anyCap } from "@/lib/roles";

export const runtime = "nodejs";

function authed(req: NextRequest): boolean {
  const key = process.env.ADMIN_KEY;
  return Boolean(key) && req.nextUrl.searchParams.get("key") === key;
}

export async function GET(req: NextRequest) {
  if (!authed(req)) return Response.json({ error: "auth" }, { status: 401 });
  const chats = await listChatConfigs();
  let connected = 0;
  for (const c of chats) {
    const caps = await capsForChat(c);
    if (c.enabled && anyCap(caps)) connected++;
  }
  const [messagesStored, messagesFromAsya, articles, spaces, sections] = await Promise.all([
    totalStoredMessages(), totalFromBot(), listArticles(), listSpaces(), sectionCounts(),
  ]);
  return Response.json({
    chatsConnected: connected,
    chatsTotal: chats.length,
    messagesStored,
    messagesFromAsya,
    articles: articles.length,
    spaces: spaces.length,
    sections,
  });
}
