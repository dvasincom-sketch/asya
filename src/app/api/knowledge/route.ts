import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { complete, hasKey } from "@/lib/timeweb";
import { topicIcon, normalizeTopic, TOPIC_NAMES } from "@/lib/topics";

export const runtime = "nodejs";

type FactRow = { id: string; fact: string; topic: string | null; createdAt: Date };

// Мягкий доступ к полям, которых может не быть в локально сгенерированном клиенте.
type MemDb = {
  findMany: (a: {
    where: { userId: string };
    orderBy: { createdAt: "desc" };
    take?: number;
  }) => Promise<FactRow[]>;
  update: (a: { where: { id: string }; data: { topic: string } }) => Promise<unknown>;
};
function memDb(): MemDb {
  return prisma.memory as unknown as MemDb;
}
type UserDb = {
  update: (a: { where: { id: string }; data: { portrait: string; portraitAt: Date } }) => Promise<unknown>;
};
function userDb(): UserDb {
  return prisma.user as unknown as UserDb;
}

// Разложить по темам факты, у которых темы ещё нет (например, сохранённые до обновления).
async function backfillTopics(rows: FactRow[]): Promise<FactRow[]> {
  const untagged = rows.filter((r) => !r.topic).slice(0, 30);
  if (!untagged.length || !hasKey()) return rows;

  const sys =
    `Разложи факты о человеке по темам. Верни СТРОГО JSON-массив строк — тему для каждого факта по порядку, ` +
    `ровно из списка: ${TOPIC_NAMES.join(", ")}. Столько же элементов, сколько фактов.`;
  const raw = await complete(
    [{ role: "user", content: untagged.map((r, i) => `${i + 1}. ${r.fact}`).join("\n") }],
    sys,
    300,
  );
  const m = raw.match(/\[[\s\S]*\]/);
  if (!m) return rows;

  try {
    const arr: unknown = JSON.parse(m[0]);
    if (!Array.isArray(arr)) return rows;
    const assigned = new Map<string, string>();
    untagged.forEach((r, i) => {
      const topic = normalizeTopic(arr[i]);
      assigned.set(r.id, topic);
    });
    await Promise.all(
      [...assigned.entries()].map(([id, topic]) => memDb().update({ where: { id }, data: { topic } }).catch(() => {})),
    );
    return rows.map((r) => (assigned.has(r.id) ? { ...r, topic: assigned.get(r.id)! } : r));
  } catch {
    return rows;
  }
}

// Портрет «Как я тебя вижу» — из реальных фактов, с кэшем на сутки.
async function ensurePortrait(
  user: { id: string; portrait?: string | null; portraitAt?: Date | null },
  facts: FactRow[],
): Promise<string> {
  const cached = user.portrait || "";
  const fresh = user.portraitAt && Date.now() - new Date(user.portraitAt).getTime() < 24 * 3600 * 1000;
  if (cached && fresh) return cached;
  if (!facts.length || !hasKey()) return cached;

  const sys =
    `Ты — Ася, тёплая подружка. По списку того, что ты знаешь о человеке, напиши короткий бережный портрет: ` +
    `2–3 предложения, обращение на «ты», живым языком, без списков и без оценок свысока. ` +
    `Опирайся только на факты из списка, ничего не додумывай. Начни не с «ты», а естественно.`;
  const text = await complete([{ role: "user", content: facts.map((f) => f.fact).join("; ") }], sys, 260);
  const portrait = text.trim();
  if (!portrait) return cached;

  await userDb().update({ where: { id: user.id }, data: { portrait, portraitAt: new Date() } }).catch(() => {});
  return portrait;
}

export async function GET() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return Response.json({ user: null, portrait: "", themes: [] });

  let facts = await memDb()
    .findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 300 })
    .catch(() => [] as FactRow[]);

  facts = await backfillTopics(facts).catch(() => facts);

  // Сохранённые разборы — чтобы считать их в темах.
  type SessRow = { id: string; template: string; savedAt: Date | null; createdAt: Date };
  const sessDb = prisma as unknown as {
    coachSession: {
      findMany: (a: {
        where: { userId: string; savedAt: { not: null } };
        orderBy: { createdAt: "desc" };
        take: number;
      }) => Promise<SessRow[]>;
    };
  };
  const sessions = await sessDb.coachSession
    .findMany({ where: { userId: user.id, savedAt: { not: null } }, orderBy: { createdAt: "desc" }, take: 50 })
    .catch(() => [] as SessRow[]);

  // Группируем по темам.
  const groups = new Map<string, { count: number; updatedAt: Date; line: string }>();
  for (const f of facts) {
    const topic = f.topic || "Разное";
    const g = groups.get(topic);
    if (!g) groups.set(topic, { count: 1, updatedAt: f.createdAt, line: f.fact });
    else {
      g.count += 1;
      if (new Date(f.createdAt) > new Date(g.updatedAt)) g.updatedAt = f.createdAt;
    }
  }

  const portrait = await ensurePortrait(user, facts).catch(() => user.portrait || "");

  const themes = [...groups.entries()]
    .map(([name, g]) => ({
      name,
      icon: topicIcon(name),
      line: g.line,
      count: g.count,
      updatedAt: g.updatedAt,
    }))
    .sort((a, b) => b.count - a.count)
    .map((t, i) => ({ ...t, big: i === 0 && t.count >= 3 }));

  return Response.json({
    user: { id: user.id },
    portrait,
    totalFacts: facts.length,
    savedCount: sessions.length,
    themes,
  });
}
