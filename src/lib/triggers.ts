// Триггерные сообщения по событиям CRM (Yclients): подтверждение записи и др.
// MVP: событие «запись создана» → сообщение в Telegram владельцу и клиенту (если его номер связан с ботом).
import { prisma } from "./prisma";
import { normalizePhone } from "./phone";
import { tgSend } from "./tgbot";

type AnyObj = Record<string, unknown>;

function str(v: unknown): string { return v == null ? "" : String(v); }
function asObj(v: unknown): AnyObj { return v && typeof v === "object" ? (v as AnyObj) : {}; }

// Красивое время из datetime/date Yclients ("2026-08-10T15:00:00+03:00" или "2026-08-10 15:00:00").
function fmtWhen(raw: string): string {
  if (!raw) return "";
  const m = /(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(raw);
  if (!m) return raw;
  return `${m[3]}.${m[2]} в ${m[4]}:${m[5]}`;
}

type Parsed = { status: string; resource: string; service: string; staff: string; when: string; clientName: string; clientPhone: string };

function parseRecord(evt: AnyObj): Parsed {
  const data = asObj(evt.data);
  const services = Array.isArray(data.services) ? (data.services as AnyObj[]) : [];
  const service = services.map((s) => str(s.title)).filter(Boolean).join(", ");
  const staff = str(asObj(data.staff).name) || str(data.staff_name);
  const when = fmtWhen(str(data.datetime) || str(data.date));
  const client = asObj(data.client);
  return {
    status: str(evt.status).toLowerCase(),
    resource: str(evt.resource).toLowerCase(),
    service,
    staff,
    when,
    clientName: str(client.name) || str(data.client_name),
    clientPhone: str(client.phone) || str(data.client_phone),
  };
}

async function notifyOwner(text: string): Promise<void> {
  const chat = process.env.TRIGGERS_TG_CHAT_ID;
  if (!chat) { console.warn("[triggers] TRIGGERS_TG_CHAT_ID не задан — некому слать владельцу"); return; }
  await tgSend(chat, text);
}

async function notifyClientByPhone(phone: string, text: string): Promise<boolean> {
  if (!phone) return false;
  const p = normalizePhone(phone);
  const user = await prisma.user.findUnique({ where: { phone: p }, select: { tgId: true } }).catch(() => null);
  if (!user?.tgId) return false;
  await tgSend(Number(user.tgId), text);
  return true;
}

// Точка входа: разбираем событие(я) Yclients и рассылаем триггеры.
export async function handleYclientsEvents(payload: unknown): Promise<{ handled: number }> {
  const events: AnyObj[] = Array.isArray(payload) ? (payload as AnyObj[]) : [asObj(payload)];
  let handled = 0;
  for (const evt of events) {
    const r = parseRecord(evt);
    // Пока обрабатываем только создание записи.
    if (r.resource && r.resource !== "record") continue;
    if (r.status && r.status !== "create") continue;

    const lines = [
      "🗓 Новая запись",
      r.service && `Услуга: ${r.service}`,
      r.staff && `Мастер: ${r.staff}`,
      r.when && `Когда: ${r.when}`,
      (r.clientName || r.clientPhone) && `Клиент: ${[r.clientName, r.clientPhone].filter(Boolean).join(", ")}`,
    ].filter(Boolean) as string[];
    await notifyOwner(lines.join("\n"));

    if (r.clientPhone) {
      const clientMsg = [
        `${r.clientName || "Здравствуйте"}, вы записаны 🤍`,
        r.service && r.service,
        r.staff && `Мастер: ${r.staff}`,
        r.when && `Когда: ${r.when}`,
        "Будем рады видеть вас! Если планы изменятся — просто дайте знать.",
      ].filter(Boolean).join("\n");
      await notifyClientByPhone(r.clientPhone, clientMsg).catch(() => false);
    }
    handled++;
  }
  return { handled };
}
