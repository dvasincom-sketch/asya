// Разбор звонка: по расшифровке сообщения звонящего Ася делает короткую сводку и оценку важности.
import { complete } from "./timeweb";

export type CallTriage = { summary: string; importance: string; category: string };

const SYS = `Ты — Ася, ассистент, которая приняла звонок вместо своего человека и записала сообщение звонящего.
По расшифровке сделай короткую сводку для своего человека: кто звонил и по какому вопросу, что нужно.
Верни СТРОГО JSON без пояснений и без разметки: {"summary": "...", "importance": "spam|low|normal|important", "category": "короткая метка"}.
summary — одно-два предложения по-русски, по делу, живым тёплым языком, от третьего лица («звонили из…», «просят…»).
importance: spam — реклама, робот, мошенники; low — неважное; normal — обычное; important — срочное, личное, деньги, здоровье, близкие.
category — короткая метка одним-двумя словами (например: доставка, банк, спам, работа, врач, близкие).`;

export async function triageCall(transcript: string, fromNumber?: string | null): Promise<CallTriage> {
  const t = (transcript || "").trim();
  if (!t) return { summary: "Звонящий не оставил сообщения.", importance: "unknown", category: "" };
  const user = `Номер: ${fromNumber || "скрыт"}\nРасшифровка сообщения звонящего:\n${t}`;
  const raw = await complete([{ role: "user", content: user }], SYS, 300).catch(() => "");
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      const j = JSON.parse(m[0]) as { summary?: unknown; importance?: unknown; category?: unknown };
      const imp = String(j.importance || "");
      return {
        summary: String(j.summary || "").trim() || t.slice(0, 200),
        importance: ["spam", "low", "normal", "important"].includes(imp) ? imp : "normal",
        category: String(j.category || "").trim().slice(0, 40),
      };
    }
  } catch {
    /* fallthrough */
  }
  return { summary: t.slice(0, 200), importance: "normal", category: "" };
}
