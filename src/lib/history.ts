// История сообщений чатов: хранение + статистика + выжимка.
// Ася хранит переписку у себя, чтобы не обращаться к самому чату и уметь делать выжимку.
import { complete } from "./timeweb";
import { prisma } from "./prisma";
import { listArticles, upsertArticle } from "./knowledge";

export type StoredMessage = {
  id: string; chatId: string; messageId: number | null;
  userId: string | null; userName: string | null; text: string; createdAt: Date;
};

type MsgDelegate = {
  create: (a: { data: Record<string, unknown> }) => Promise<unknown>;
  findMany: (a: unknown) => Promise<StoredMessage[]>;
  count: (a?: unknown) => Promise<number>;
};
function mdb(): MsgDelegate {
  return (prisma as unknown as { chatMessage: MsgDelegate }).chatMessage;
}

// Сохранить одно сообщение группы. Фоново, ошибки не роняют вебхук.
export async function saveMessage(m: {
  chatId: number | string; messageId?: number; userId?: number | string; userName?: string; text: string;
}): Promise<void> {
  const text = (m.text || "").trim();
  if (!text) return;
  await mdb().create({
    data: {
      chatId: String(m.chatId),
      messageId: m.messageId ?? null,
      userId: m.userId != null ? String(m.userId) : null,
      userName: m.userName || null,
      text: text.slice(0, 4000),
    },
  }).catch(() => {});
}

// Статистика истории по чату: сколько сохранено и когда последнее сообщение.
export async function historyStats(chatId: number | string): Promise<{ count: number; lastAt: string | null }> {
  const cid = String(chatId);
  const count = await mdb().count({ where: { chatId: cid } }).catch(() => 0);
  if (!count) return { count: 0, lastAt: null };
  const last = await mdb().findMany({ where: { chatId: cid }, orderBy: { createdAt: "desc" }, take: 1 }).catch(() => [] as StoredMessage[]);
  const at = last[0]?.createdAt;
  return { count, lastAt: at ? new Date(at).toISOString() : null };
}

// Последние N сообщений в хронологическом порядке (для контекста выжимки).
export async function recentMessages(chatId: number | string, limit = 500): Promise<StoredMessage[]> {
  const rows = await mdb().findMany({
    where: { chatId: String(chatId) },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 1000),
  }).catch(() => [] as StoredMessage[]);
  return rows.reverse();
}

// Сделать выжимку из истории чата и сохранить её в базу знаний раздела как авто-статью.
// Одна «живая» выжимка на раздел — обновляется на месте, чтобы не засорять базу и контекст.
export async function digestChat(chatId: number | string, space: string): Promise<{ ok: boolean; digest: string; count: number }> {
  const msgs = await recentMessages(chatId, 500);
  if (!msgs.length) return { ok: false, digest: "", count: 0 };
  const transcript = msgs.map((m) => `${m.userName || "участник"}: ${m.text}`).join("\n").slice(0, 14000);
  const system = `Ты — аналитик сообщества. На вход — история сообщений одного Telegram-чата.
Сделай сжатую выжимку на русском для базы знаний Аси, обычным текстом с короткими подзаголовками:
1) Частые вопросы участников и короткие ответы на них (если ответ звучал в чате).
2) Ключевые факты о сообществе и продукте, всплывшие в переписке.
3) Повторяющиеся темы и боли участников.
Пиши по делу, без воды. Не выдумывай того, чего нет в переписке.`;
  const digest = (await complete([{ role: "user", content: transcript }], system, 900).catch(() => "")).trim();
  if (!digest) return { ok: false, digest: "", count: msgs.length };
  const sp = space || "default";
  const existing = (await listArticles(sp)).find((a) => a.source === "history");
  const date = new Date().toISOString().slice(0, 10);
  await upsertArticle({ id: existing?.id, space: sp, title: `Выжимка из истории чата (обновлено ${date})`, body: digest, source: "history" });
  return { ok: true, digest, count: msgs.length };
}
