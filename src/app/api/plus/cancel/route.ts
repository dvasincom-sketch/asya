import { getCurrentUser } from "@/lib/auth";
import { cancelSub } from "@/lib/plus";

export const runtime = "nodejs";

// Отмена: доступ сохраняется до конца оплаченного периода, дальше не продлеваем.
export async function POST() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return Response.json({ error: "auth" }, { status: 401 });
  await cancelSub(user.id);
  return Response.json({ ok: true });
}
