import { NextRequest } from "next/server";
import { recentMessages } from "@/lib/history";

export const runtime = "nodejs";

function authed(req: NextRequest): boolean {
  const key = process.env.ADMIN_KEY;
  return Boolean(key) && req.nextUrl.searchParams.get("key") === key;
}

export async function GET(req: NextRequest) {
  if (!authed(req)) return Response.json({ error: "auth" }, { status: 401 });
  const chatId = req.nextUrl.searchParams.get("chatId");
  if (!chatId) return Response.json({ error: "chatId" }, { status: 400 });
  const rows = await recentMessages(chatId, 200);
  const messages = rows.map((m) => ({ userName: m.userName, text: m.text, fromBot: (m as unknown as { fromBot?: boolean }).fromBot === true, createdAt: m.createdAt }));
  return Response.json({ messages });
}
