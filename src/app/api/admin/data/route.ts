import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function authed(req: NextRequest): boolean {
  const key = process.env.ADMIN_KEY;
  return Boolean(key) && req.nextUrl.searchParams.get("key") === key;
}

// Человеческие описания известных сущностей (что именно там копится).
const DESC: Record<string, { title: string; desc: string }> = {
  User: { title: "Пользователи", desc: "Профили людей (Telegram/телефон), согласия, настройки" },
  Message: { title: "Диалоги с Асей", desc: "Сообщения личных разговоров с Асей" },
  Memory: { title: "Память Аси", desc: "Что Ася запомнила о человеке" },
  ChatMessage: { title: "История чатов-проектов", desc: "Сообщения групп, где работает Ася" },
  KnowledgeArticle: { title: "База знаний", desc: "Статьи, по которым Ася отвечает" },
  ChatConfig: { title: "Проекты (чаты)", desc: "Чаты, роли, разделы, репозитории, команды" },
  RoleDef: { title: "Роли", desc: "Наборы возможностей бота" },
  VerifiedMember: { title: "Прошли капчу", desc: "Участники, подтвердившие, что они люди" },
  Call: { title: "Звонки", desc: "Записи автоответчика (резюме, важность)" },
  OtpCode: { title: "Коды входа", desc: "Одноразовые SMS-коды авторизации" },
  CrisisEvent: { title: "Кризис-события", desc: "Отметки тревожных сообщений" },
  Session: { title: "Сессии входа", desc: "Активные сессии пользователей" },
  CoachSession: { title: "Сессии-практики", desc: "Структурированные сессии" },
  PrivateMessage: { title: "Личные сообщения", desc: "Инкогнито-переписка (зашифрована)" },
  ProfileAnswer: { title: "Ответы профиля", desc: "Ответы на вопросы профиля" },
  HealthDoc: { title: "Документы здоровья", desc: "Загруженные анализы/заключения" },
  HealthMarker: { title: "Показатели здоровья", desc: "Разобранные медпоказатели" },
  Consent: { title: "Согласия", desc: "Согласия на обработку данных" },
  Subscription: { title: "Подписки", desc: "Платные подписки" },
  CrisisEvents: { title: "Кризис-события", desc: "Отметки тревожных сообщений" },
  VideoSummary: { title: "Саммари видео", desc: "Кэш кратких содержаний по транскриптам" },
};

export async function GET(req: NextRequest) {
  if (!authed(req)) return Response.json({ error: "auth" }, { status: 401 });
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ table: string; rows: number | bigint }>>(
      `SELECT relname AS "table", n_live_tup AS "rows" FROM pg_stat_user_tables ORDER BY n_live_tup DESC`,
    );
    const tables = rows
      .filter((r) => r.table !== "_prisma_migrations")
      .map((r) => {
        const meta = DESC[r.table];
        return { table: r.table, rows: Number(r.rows), title: meta?.title || r.table, desc: meta?.desc || "" };
      });
    const totalRows = tables.reduce((s, t) => s + t.rows, 0);
    return Response.json({ ok: true, tables, totalTables: tables.length, totalRows });
  } catch (e) {
    console.error("[admin/data]", e instanceof Error ? e.message : String(e));
    return Response.json({ ok: false, error: "db", tables: [] });
  }
}
