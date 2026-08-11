import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listClientsForUser, createClient, deleteOwnedClient, setOwnedEnabled } from "@/lib/apiClients";

export const runtime = "nodejs";

// Ключи текущего пользователя (авторизация — сессия по телефону). Владелец видит
// полный токен своих ключей (это его секрет).
export async function GET() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const keys = await listClientsForUser(user.id).catch(() => []);
  return Response.json({
    ok: true,
    keys: keys.map((k) => ({ id: k.id, name: k.name, token: k.token, capability: k.capability, enabled: k.enabled, calls: k.calls, lastUsedAt: k.lastUsedAt })),
  });
}

// Создать ключ / отозвать / включить-выключить — всё для своих ключей.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => null)) as { action?: string; id?: string; name?: string; enabled?: boolean } | null;
  const action = b?.action || "create";

  if (action === "create") {
    const c = await createClient((b?.name || "Мой проект").trim(), "generate", undefined, user.id);
    if (!c) return Response.json({ ok: false, error: "create_failed" }, { status: 500 });
    return Response.json({ ok: true, key: { id: c.id, name: c.name, token: c.token, capability: c.capability, enabled: c.enabled, calls: c.calls, lastUsedAt: c.lastUsedAt } });
  }
  if (action === "toggle" && b?.id) {
    const ok = await setOwnedEnabled(b.id, user.id, Boolean(b.enabled));
    return Response.json({ ok });
  }
  if (action === "revoke" && b?.id) {
    const ok = await deleteOwnedClient(b.id, user.id);
    return Response.json({ ok });
  }
  return Response.json({ ok: false, error: "bad_action" }, { status: 400 });
}
