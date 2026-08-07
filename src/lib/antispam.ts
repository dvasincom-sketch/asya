// Комьюнити-менеджер: антиспам-логика (Фаза 1). Механика без внешних таймеров и лишнего состояния.
import { complete } from "./timeweb";

// --- CAS (Combot Anti-Spam): публичная база спамеров ---
export async function casBanned(userId: number | string): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(`https://api.cas.chat/check?user_id=${encodeURIComponent(String(userId))}`, { signal: ctrl.signal });
    clearTimeout(to);
    if (!res.ok) return false;
    const j = (await res.json().catch(() => null)) as { ok?: boolean } | null;
    return j?.ok === true; // ok:true => пользователь в списке спамеров
  } catch {
    return false;
  }
}

// --- Подозрительное имя новичка ---
const NAME_SPAM = /(продвижен|реклам|казино|casino|crypto|крипт|заработок|инвест|знакомств|18\+|порн|ставк|букмекер|нюдс|nude|adult|секс)/i;
// zalgo — переизбыток комбинирующих диакритических знаков.
const ZALGO = /[̀-ͯ҉]/g;

export function suspiciousName(first?: string, last?: string, username?: string | null): { bad: boolean; reason: string } {
  const name = `${first || ""} ${last || ""}`.trim();
  if (NAME_SPAM.test(name)) return { bad: true, reason: "имя с рекламой/спамом" };
  if ((name.match(ZALGO) || []).length > 4) return { bad: true, reason: "zalgo в имени" };
  if (name.length > 64) return { bad: true, reason: "слишком длинное имя" };
  // Фильтр «нет @username» и языковые фильтры (арабица/иероглифы) намеренно ВЫКЛ по умолчанию —
  // слишком часто бьют по живым людям. При желании включаются отдельно.
  return { bad: false, reason: "" };
}

// --- Ссылки в сообщении ---
type Entity = { type?: string };
const LINK_RE = /(https?:\/\/|www\.|t\.me\/|telegram\.me\/|@[A-Za-z][A-Za-z0-9_]{4,})/i;
export function hasLink(text: string, entities?: Entity[], captionEntities?: Entity[]): boolean {
  const ents = [...(entities || []), ...(captionEntities || [])];
  if (ents.some((e) => e.type === "url" || e.type === "text_link" || e.type === "mention")) return true;
  return LINK_RE.test(text || "");
}

// --- LLM-оценка: спам ли это (умнее стоп-слов) ---
const SPAM_SYS = `Ты — модератор тёплого сообщества «Ася» в Telegram. Определи, спам ли сообщение.
Спам: реклама, продажи, приглашения в другие каналы/чаты, крипта/заработок/инвестиции, «работа на дому», ставки, интим-услуги, массовая рассылка, сгенерированный нейросетью рекламный комментарий не по теме.
НЕ спам: живое человеческое общение, вопросы, эмоции, обсуждение по теме сообщества (забота о себе, чувства, отношения), даже с ошибками.
Верни СТРОГО JSON без пояснений: {"spam": true|false, "reason": "коротко"}.`;

export async function judgeSpam(text: string): Promise<{ spam: boolean; reason: string }> {
  const t = (text || "").trim();
  if (t.length < 3) return { spam: false, reason: "" };
  const raw = await complete([{ role: "user", content: t.slice(0, 1200) }], SPAM_SYS, 120).catch(() => "");
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      const j = JSON.parse(m[0]) as { spam?: unknown; reason?: unknown };
      return { spam: j.spam === true, reason: String(j.reason || "").slice(0, 120) };
    }
  } catch {
    /* ignore */
  }
  return { spam: false, reason: "" };
}

// --- LLM: тёплый ответ комьюнити-менеджера (или пусто) ---
const CM_SYS = `Ты — тёплый комьюнити-менеджер сообщества «Ася» в Telegram, в голосе Аси: по-доброму, на «ты», коротко, живым языком, без канцелярита и без списков.
Отвечай ТОЛЬКО когда это уместно: вопрос о правилах чата, растерянность новичка, вопрос про сервис Ася или как им пользоваться, приветствие. Если сообщение не требует ответа менеджера (обычная болтовня, реакция, оффтоп без вопроса) — верни пустую строку.
Про Асю: это тёплая AI-подружка, с которой можно поговорить, когда тревожно или просто хочется, чтобы услышали; живёт в Telegram и бесплатна.
Правила чата: без ссылок и рекламы (полезным можно поделиться в личку), по-доброму и с уважением, без спама.
Верни ТОЛЬКО текст ответа или пустую строку.`;

export async function communityReply(text: string): Promise<string> {
  const t = (text || "").trim();
  if (!t) return "";
  const raw = await complete([{ role: "user", content: t.slice(0, 1000) }], CM_SYS, 220).catch(() => "");
  const out = (raw || "").trim();
  // Отсекаем «пустые» ответы модели.
  if (!out || out.length < 2 || /^["'«»]*$/.test(out)) return "";
  return out;
}

// Стоит ли вообще звать LLM для контекстного ответа (экономим вызовы и шум).
export function looksLikeQuestion(text: string): boolean {
  const t = (text || "").toLowerCase();
  if (t.includes("?")) return true;
  return /(правил|ссылк|почему|как |что такое|ася|асе|асю|можно ли|подскаж|помоги|не работает|как польз)/.test(t);
}
