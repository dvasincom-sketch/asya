// Правки редактора проекта (из студии content-box) → few-shot примеры для Аси.
// Пишем каждую правку и отдаём последние N как компактный текст для промпта.
import { prisma } from "./prisma";

type Row = { before: string | null; after: string; title: string | null; kind: string };
type Delegate = {
  create: (a: { data: Record<string, unknown> }) => Promise<unknown>;
  findMany: (a: { where: Record<string, unknown>; orderBy?: unknown; take?: number }) => Promise<Row[]>;
};
function db(): Delegate {
  return (prisma as unknown as { projectCorrection: Delegate }).projectCorrection;
}

export async function addCorrection(a: {
  clientId: string; source?: string; title?: string; kind?: string; before?: string; after: string;
}): Promise<void> {
  await db()
    .create({
      data: {
        clientId: a.clientId,
        source: a.source || null,
        title: a.title || null,
        kind: a.kind || "summary",
        before: a.before || null,
        after: a.after,
      },
    })
    .catch(() => {});
}

// Последние правки клиента как few-shot блок (или "" если их нет).
export async function recentCorrections(clientId: string, kind = "summary", take = 5): Promise<string> {
  const rows = await db()
    .findMany({ where: { clientId, kind }, orderBy: { createdAt: "desc" }, take })
    .catch(() => [] as Row[]);
  if (!rows.length) return "";
  return rows
    .map((r, i) => {
      const before = (r.before || "").replace(/\s+/g, " ").trim().slice(0, 400);
      const after = (r.after || "").replace(/\s+/g, " ").trim().slice(0, 500);
      return `Пример ${i + 1}${r.title ? ` (видео «${r.title}»)` : ""}:${before ? `\nБыло: ${before}` : ""}\nКак надо: ${after}`;
    })
    .join("\n\n");
}
