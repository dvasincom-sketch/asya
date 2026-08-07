// Триггерные сообщения по событиям CRM: подтверждение записи и др.
// Каналы MVP: Telegram владельцу и клиенту (если его номер связан с ботом).
import { prisma } from "./prisma";
import { normalizePhone } from "./phone";
import { tgSend } from "./tgbot";

type AnyObj = Record<string, unknown>;
function str(v: unknown): string { return v == null ? "" : String(v); }
function asObj(v: unknown): AnyObj { return v && typeof v === "object" ? (v as AnyObj) : {}; }

// Красивое время из datetime/date ("2026-08-10T15:00:00+03:00" или "2026-08-10 15:00:00").
export function fmtWhen(raw: string): string {
  if (!raw) return "";
  const m = /(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(raw);
  if (!m) return raw;
  return `${m[3]}.${m[2]} в ${m[4]}:${m[5]}`;
}

export type BookingInfo = { service: string; staff: string; when: string; clientName: string; clientPhone: string };

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

// Отправить подтверждение записи (владельцу всегда, клиенту — если он связан с ботом).
export async function sendBookingConfirmation(info: BookingInfo): Promise<void> {
  const ownerLines = [
    "🗓 Новая запись",
    info.service && `Услуга: ${info.service}`,
    info.staff && `Мастер: ${info.staff}`,
    info.when && `Когда: ${info.when}`,
    (info.clientName || info.clientPhone) && `Клиент: ${[info.clientName, info.clientPhone].filter(Boolean).join(", ")}`,
  ].filter(Boolean) as string[];
  console.log(`[triggers] запись создана: ${info.service} / ${info.staff} / ${info.when} / ${info.clientPhone}`);
  await notifyOwner(ownerLines.join("\n"));

  if (info.clientPhone) {
    const clientMsg = [
      `${info.clientName || "Здравствуйте"}, вы записаны 🤍`,
      info.service && info.service,
      info.staff && `Мастер: ${info.staff}`,
      info.when && `Когда: ${info.when}`,
      "Будем рады видеть вас! Если планы изменятся — просто дайте знать.",
    ].filter(Boolean).join("\n");
    await notifyClientByPhone(info.clientPhone, clientMsg).catch(() => false);
  }
}

// Событие(я) из вебхука Yclients → подтверждение записи.
export async function handleYclientsEvents(payload: unknown): Promise<{ handled: number }> {
  const events: AnyObj[] = Array.isArray(payload) ? (payload as AnyObj[]) : [asObj(payload)];
  let handled = 0;
  for (const evt of events) {
    const status = str(evt.status).toLowerCase();
    const resource = str(evt.resource).toLowerCase();
    if (resource && resource !== "record") continue;
    if (status && status !== "create") continue;
    const data = asObj(evt.data);
    const services = Array.isArray(data.services) ? (data.services as AnyObj[]) : [];
    const client = asObj(data.client);
    await sendBookingConfirmation({
      service: services.map((s) => str(s.title)).filter(Boolean).join(", "),
      staff: str(asObj(data.staff).name) || str(data.staff_name),
      when: fmtWhen(str(data.datetime) || str(data.date)),
      clientName: str(client.name) || str(data.client_name),
      clientPhone: str(client.phone) || str(data.client_phone),
    });
    handled++;
  }
  return { handled };
}
