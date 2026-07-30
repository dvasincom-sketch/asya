import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Выгрузка всех данных пользователя одним JSON-файлом (право на переносимость данных).
export async function GET() {
  const u = await getCurrentUser().catch(() => null);
  if (!u) return Response.json({ error: "auth" }, { status: 401 });

  type HDoc = { title: string; kind: string; docDate: Date | null; lab: string | null; summary: string | null; createdAt: Date };
  type HMark = { name: string; code: string; value: number | null; valueText: string | null; unit: string | null; refText: string | null; flag: string | null; takenAt: Date | null };
  const hdb = prisma as unknown as {
    healthDoc: { findMany: (a: unknown) => Promise<HDoc[]> };
    healthMarker: { findMany: (a: unknown) => Promise<HMark[]> };
  };

  const [messages, memories, healthDocs, healthMarkers] = await Promise.all([
    prisma.message.findMany({ where: { userId: u.id }, orderBy: { createdAt: "asc" } }).catch(() => []),
    prisma.memory.findMany({ where: { userId: u.id }, orderBy: { createdAt: "asc" } }).catch(() => []),
    hdb.healthDoc.findMany({ where: { userId: u.id }, orderBy: { createdAt: "asc" } }).catch(() => [] as HDoc[]),
    hdb.healthMarker.findMany({ where: { userId: u.id }, orderBy: { takenAt: "asc" } }).catch(() => [] as HMark[]),
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
    health: {
      documents: healthDocs.map((d) => ({
        title: d.title, kind: d.kind, docDate: d.docDate, lab: d.lab, summary: d.summary, createdAt: d.createdAt,
      })),
      markers: healthMarkers.map((m) => ({
        name: m.name, code: m.code, value: m.value, valueText: m.valueText,
        unit: m.unit, reference: m.refText, flag: m.flag, takenAt: m.takenAt,
      })),
    },
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="asya-data.json"',
    },
  });
}
