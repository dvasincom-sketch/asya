import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Выгрузка всех данных пользователя одним JSON-файлом (право на переносимость данных).
export async function GET() {
  const u = await getCurrentUser().catch(() => null);
  if (!u) return Response.json({ error: "auth" }, { status: 401 });

  const [messages, memories] = await Promise.all([
    prisma.message.findMany({ where: { userId: u.id }, orderBy: { createdAt: "asc" } }).catch(() => []),
    prisma.memory.findMany({ where: { userId: u.id }, orderBy: { createdAt: "asc" } }).catch(() => []),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    profile: {
      id: u.id,
      phone: u.phone,
      tgId: u.tgId ? String(u.tgId) : null,
      createdAt: u.createdAt,
      memoryEnabled: u.memoryEnabled,
      historyEnabled: u.historyEnabled,
      remindersEnabled: u.remindersEnabled,
    },
    memories: memories.map((m: { fact: string; createdAt: Date }) => ({ fact: m.fact, createdAt: m.createdAt })),
    messages: messages.map((m: { role: string; content: string; createdAt: Date }) => ({
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
    })),
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="asya-data.json"',
    },
  });
}
