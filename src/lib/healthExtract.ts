// Разбор медицинского документа: из текста — только напечатанные факты.
// Никаких диагнозов, причин и рекомендаций от модели: она работает как аккуратный переписчик.
import { complete } from "./timeweb";

export type RawMarker = {
  name: string;
  value: number | null;
  valueText: string | null;
  unit: string | null;
  refLow: number | null;
  refHigh: number | null;
  refText: string | null;
  flag: "norm" | "low" | "high" | null;
};

export type RawFollowUp = { title: string; afterMonths: number | null; dueDate: string | null };

export type Extracted = {
  kind: "lab" | "conclusion" | "imaging" | "other";
  title: string;
  docDate: string | null;
  lab: string | null;
  summary: string;
  markers: RawMarker[];
  followUps: RawFollowUp[];
};

const SYSTEM = `Ты — модуль разбора медицинских документов. Твоя работа — аккуратно перенести в структуру то, что НАПЕЧАТАНО в документе. Ты не врач и не толкователь.

Строгие правила:
1. Бери только то, что есть в тексте. Если чего-то нет — ставь null. Никогда не додумывай значения, единицы, референсы и даты.
2. Не ставь диагнозов, не пиши причины отклонений, не давай советов по лечению, питанию и добавкам.
3. flag ставь только если это следует из самого документа: либо документ прямо помечает результат как отклонение, либо значение выходит за напечатанный референсный интервал. Иначе null.
4. В summary — 1–2 нейтральных предложения о том, что это за документ (вид, дата, лаборатория, набор показателей). Без оценок и выводов. Обычный текст без разметки: без звёздочек, решёток и списков.
5. followUps заполняй ТОЛЬКО если в документе прямо написана рекомендация повторить анализ или прийти на приём (например «повторить через 3 месяца»). Своих рекомендаций не придумывай. Если таких фраз нет — пустой массив.

Верни СТРОГО JSON без пояснений:
{"kind":"lab|conclusion|imaging|other","title":"краткое название документа","docDate":"YYYY-MM-DD или null","lab":"лаборатория/клиника или null","summary":"...","markers":[{"name":"как в документе","value":число или null,"valueText":"если значение не число, иначе null","unit":"или null","refLow":число или null,"refHigh":число или null,"refText":"референс как напечатан или null","flag":"norm|low|high или null"}],"followUps":[{"title":"что повторить","afterMonths":число или null,"dueDate":"YYYY-MM-DD или null"}]}`;

function num(v: unknown): number | null {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") {
    const s = v.replace(",", ".").replace(/[^\d.\-]/g, "");
    const n = parseFloat(s);
    return isFinite(n) ? n : null;
  }
  return null;
}
function str(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, 300) : null;
}
function isoDate(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  // Принимаем и 2026-03-12, и 12.03.2026.
  const m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m1) return `${m1[1]}-${m1[2]}-${m1[3]}`;
  const m2 = s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/);
  if (m2) return `${m2[3]}-${m2[2].padStart(2, "0")}-${m2[1].padStart(2, "0")}`;
  return null;
}

export async function extractDocument(text: string): Promise<Extracted | null> {
  const body = text.slice(0, 14000); // разумный предел на один запрос
  const raw = await complete([{ role: "user", content: body }], SYSTEM, 2400);
  if (!raw) return null;

  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;

  try {
    const j = JSON.parse(m[0]) as Record<string, unknown>;
    const kindRaw = String(j.kind || "lab");
    const kind = (["lab", "conclusion", "imaging", "other"] as const).includes(kindRaw as "lab")
      ? (kindRaw as Extracted["kind"])
      : "other";

    const markersIn = Array.isArray(j.markers) ? j.markers : [];
    const markers: RawMarker[] = markersIn
      .map((x) => {
        const o = (x || {}) as Record<string, unknown>;
        const flagRaw = str(o.flag);
        const flag =
          flagRaw === "norm" || flagRaw === "low" || flagRaw === "high" ? (flagRaw as RawMarker["flag"]) : null;
        return {
          name: str(o.name) || "",
          value: num(o.value),
          valueText: str(o.valueText),
          unit: str(o.unit),
          refLow: num(o.refLow),
          refHigh: num(o.refHigh),
          refText: str(o.refText),
          flag,
        };
      })
      .filter((x) => x.name && (x.value !== null || x.valueText))
      .slice(0, 120);

    const fuIn = Array.isArray(j.followUps) ? j.followUps : [];
    const followUps: RawFollowUp[] = fuIn
      .map((x) => {
        const o = (x || {}) as Record<string, unknown>;
        return { title: str(o.title) || "", afterMonths: num(o.afterMonths), dueDate: isoDate(o.dueDate) };
      })
      .filter((x) => x.title)
      .slice(0, 10);

    return {
      kind,
      title: str(j.title) || "Медицинский документ",
      docDate: isoDate(j.docDate),
      lab: str(j.lab),
      summary: str(j.summary) || "",
      markers,
      followUps,
    };
  } catch {
    return null;
  }
}

// Флаг по напечатанному референсу — на случай, если модель его не поставила.
export function flagFromRef(m: RawMarker): "norm" | "low" | "high" | null {
  if (m.flag) return m.flag;
  if (m.value === null) return null;
  if (m.refLow !== null && m.value < m.refLow) return "low";
  if (m.refHigh !== null && m.value > m.refHigh) return "high";
  if (m.refLow !== null || m.refHigh !== null) return "norm";
  return null;
}
