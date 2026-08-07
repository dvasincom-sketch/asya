import { NextRequest } from "next/server";
import { fetchRepoContext, parseRepo } from "@/lib/repoSource";

export const runtime = "nodejs";

function authed(req: NextRequest): boolean {
  const key = process.env.ADMIN_KEY;
  return Boolean(key) && req.nextUrl.searchParams.get("key") === key;
}

export async function POST(req: NextRequest) {
  if (!authed(req)) return Response.json({ error: "auth" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const url = typeof b.url === "string" ? b.url : "";
  const ref = parseRepo(url);
  if (!ref) return Response.json({ ok: false, reason: "bad_url" });
  const text = await fetchRepoContext(url);
  if (!text) return Response.json({ ok: false, reason: "empty", repo: `${ref.owner}/${ref.repo}` });
  return Response.json({ ok: true, repo: `${ref.owner}/${ref.repo}`, chars: text.length, preview: text.slice(0, 600) });
}
