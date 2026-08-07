import { NextRequest } from "next/server";
import { listChatConfigs } from "@/lib/communityConfig";
import { listArticles, listSpaces } from "@/lib/knowledge";
import { totalStoredMessages, totalFromBot } from "@/lib/history";
import { capsForRole, seedRoles } from "@/lib/roles";

export const runtime = "nodejs";

function authed(req: NextRequest): boolean {
  const key = process.env.ADMIN_KEY;
  return Boolean(key) && req.nextUrl.searchParams.get("key") === key;
}

export async function GET(req: NextRequest) {
  if (!authed(req)) return Response.json({ error: "auth" }, { status: 401 });
  await seedRoles();
  const chats = await listChatConfigs();
  let connected = 0;
  for (const c of chats) {
    const caps = await capsForRole(c.role);
    if (c.enabled && (caps.support || caps.moderation || caps.captcha)) connected++;
  }
  const [messagesStored, messagesFromAsya, articles, spaces] = await Promise.all([
    totalStoredMessages(), totalFromBot(), listArticles(), listSpaces(),
  ]);
  return Response.json({
    chatsConnected: connected,
    chatsTotal: chats.length,
    messagesStored,
    messagesFromAsya,
    articles: articles.length,
    spaces: spaces.length,
  });
}
