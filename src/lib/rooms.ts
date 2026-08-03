// Внутренний чат сматчившихся людей. Ася — третий участник: приветствует,
// мягко удерживает на платформе и помогает как непредвзятая сторона.
// По обоюдному согласию Асю можно убрать (приватность). Только внутри Аси —
// контакты наружу не раскрываем.
import { roomDb, roomMemberDb, roomMsgDb, type RoomRow } from "./networkDb";

export const ASYA_WELCOME =
  "Знакомьтесь 🤍 Я рядом как непредвзятая сторона — помогу, если будет неловко, и прослежу, чтобы всё было бережно. " +
  "Общайтесь спокойно здесь: так безопаснее, и вы ничем не рискуете. Если захотите поговорить наедине — сможете убрать меня из чата по обоюдному согласию.";

export const ASYA_WARN =
  "Замечу мягко 🤍 Давайте пока останемся здесь. Так спокойнее для вас обоих: я рядом как нейтральная сторона и помогу, если что, " +
  "а личные данные не уходят на сторону. Обменяться контактами всегда успеете, когда будете уверены друг в друге — спешить некуда.";

export const ASYA_FAREWELL =
  "Оставляю вас вдвоём 🤍 Дальше — приватно, меня в чате больше нет. Если понадоблюсь, всегда сможете вернуть. Берегите друг друга.";

// Детект попытки увести общение со стороны / поделиться контактом.
// Мягкая эвристика: телефоны, @юзернеймы, ссылки, названия мессенджеров, характерные фразы.
export function detectOffPlatform(text: string): boolean {
  const t = (text || "").toLowerCase();
  if (/(\+?\d[\d\-\s()]{6,}\d)/.test(t)) return true; // номер
  if (/@[a-z0-9_]{4,}/i.test(text)) return true; // юзернейм
  if (/(https?:\/\/|t\.me\/|wa\.me\/|\.ru\/|\.com\/)/i.test(t)) return true; // ссылки
  if (/(телеграм|телега|в тг\b|вотсап|ватсап|whats?app|viber|вайбер|инстаграм|\bинст[аеы]\b|скайп|signal|сигнал)/i.test(t)) return true;
  if (/(мой номер|мой ном\b|позвони|напиши мне в|перейд[её]м в|давай в личк|дам номер|скинь номер|добавь меня)/i.test(t)) return true;
  return false;
}

// Участники комнаты (двое) кроме Аси.
export async function roomUserIds(roomId: string): Promise<string[]> {
  const members = await roomMemberDb().findMany({ where: { roomId } }).catch(() => []);
  return members.map((m) => m.userId);
}

// Создать комнату для интро (idempotent) + завести участников и приветствие Аси.
export async function ensureRoom(introId: string, userA: string, userB: string): Promise<RoomRow | null> {
  const existing = await roomDb().findUnique({ where: { introId } }).catch(() => null);
  if (existing) return existing;

  const room = await roomDb().create({ data: { introId, status: "active", asyaPresent: true } }).catch(() => null);
  if (!room) return null;
  for (const uid of [userA, userB]) {
    await roomMemberDb().create({ data: { roomId: room.id, userId: uid } }).catch(() => {});
  }
  await roomMsgDb()
    .create({ data: { roomId: room.id, sender: "asya", senderId: null, kind: "system", content: ASYA_WELCOME } })
    .catch(() => {});
  return room;
}
