// Документы-контекст проекта: редактируемое дерево markdown-файлов.
// Заменяют единое поле instruction — проект держит контекст удобными документами.
// Первое открытие проекта с сидом (напр. contentbox) создаёт стартовые документы.
import { prisma } from "./prisma";
import { seedsForProject } from "./projectDocSeeds";

export type DocMeta = { id: string; path: string; title: string; size: number; updatedAt: string };
export type DocFull = DocMeta & { body: string };

type Row = { id: string; clientId: string; path: string; title: string; body: string; updatedAt: Date };
type Delegate = {
  findMany: (a: { where: Record<string, unknown>; orderBy?: unknown }) => Promise<Row[]>;
  findFirst: (a: { where: Record<string, unknown> }) => Promise<Row | null>;
  create: (a: { data: Record<string, unknown> }) => Promise<Row>;
  update: (a: { where: { id: string }; data: Record<string, unknown> }) => Promise<Row>;
  upsert: (a: { where: { clientId_path: { clientId: string; path: string } }; create: Record<string, unknown>; update: Record<string, unknown> }) => Promise<Row>;
  delete: (a: { where: { id: string } }) => Promise<unknown>;
  count: (a: { where: Record<string, unknown> }) => Promise<number>;
};
function db(): Delegate {
  return (prisma as unknown as { projectDoc: Delegate }).projectDoc;
}

// Нормализуем путь: без ведущих слэшей, слэши-разделители, .md на конце.
export function normPath(raw: string): string {
  let p = (raw || "").trim().replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+/g, "/");
  if (!p) p = "document.md";
  if (!/\.[a-z0-9]+$/i.test(p)) p += ".md";
  return p.slice(0, 300);
}

// Один раз завести стартовые документы для проекта (если у него их ещё нет).
async function ensureSeed(clientId: string, clientName: string): Promise<void> {
  const seeds = seedsForProject(clientName);
  if (!seeds.length) return;
  const has = await db().count({ where: { clientId } }).catch(() => 1);
  if (has > 0) return;
  for (const s of seeds) {
    await db().create({ data: { clientId, path: normPath(s.path), title: s.title, body: s.body } }).catch(() => {});
  }
}

export async function listDocs(clientId: string, clientName = ""): Promise<DocMeta[]> {
  await ensureSeed(clientId, clientName);
  const rows = await db().findMany({ where: { clientId }, orderBy: { path: "asc" } }).catch(() => [] as Row[]);
  return rows.map((r) => ({ id: r.id, path: r.path, title: r.title, size: r.body.length, updatedAt: r.updatedAt.toISOString() }));
}

export async function getDoc(clientId: string, id: string): Promise<DocFull | null> {
  const r = await db().findFirst({ where: { id, clientId } }).catch(() => null);
  if (!r) return null;
  return { id: r.id, path: r.path, title: r.title, size: r.body.length, updatedAt: r.updatedAt.toISOString(), body: r.body };
}

export async function saveDoc(a: { clientId: string; id?: string; path: string; title: string; body: string }): Promise<DocFull | null> {
  const path = normPath(a.path);
  const title = (a.title || path.split("/").pop() || "Документ").slice(0, 200);
  const body = a.body ?? "";
  try {
    let r: Row;
    if (a.id) {
      r = await db().update({ where: { id: a.id }, data: { path, title, body, updatedAt: new Date() } });
    } else {
      r = await db().upsert({
        where: { clientId_path: { clientId: a.clientId, path } },
        create: { clientId: a.clientId, path, title, body },
        update: { title, body, updatedAt: new Date() },
      });
    }
    return { id: r.id, path: r.path, title: r.title, size: r.body.length, updatedAt: r.updatedAt.toISOString(), body: r.body };
  } catch {
    return null;
  }
}

export async function deleteDoc(clientId: string, id: string): Promise<boolean> {
  const r = await db().findFirst({ where: { id, clientId } }).catch(() => null);
  if (!r) return false;
  return db().delete({ where: { id } }).then(() => true).catch(() => false);
}

// Склейка всех документов проекта в один контекст для промпта Аси.
export async function buildProjectContext(clientId: string, maxChars = 14000): Promise<string> {
  const rows = await db().findMany({ where: { clientId }, orderBy: { path: "asc" } }).catch(() => [] as Row[]);
  if (!rows.length) return "";
  const parts: string[] = [];
  let total = 0;
  for (const r of rows) {
    const chunk = `# ${r.title} (${r.path})\n${r.body.trim()}`;
    if (total + chunk.length > maxChars) { parts.push(chunk.slice(0, Math.max(0, maxChars - total))); break; }
    parts.push(chunk); total += chunk.length;
  }
  return parts.join("\n\n---\n\n").trim();
}
