// Нормализация названий показателей: разные лаборатории пишут одно и то же по-разному
// («Гемоглобин», «HGB», «Hb»). Без общего ключа динамику не построить.

type Syn = { code: string; label: string; names: string[] };

const SYNONYMS: Syn[] = [
  { code: "hemoglobin", label: "Гемоглобин", names: ["гемоглобин", "hgb", "hb", "haemoglobin", "hemoglobin"] },
  { code: "erythrocytes", label: "Эритроциты", names: ["эритроциты", "rbc"] },
  { code: "leukocytes", label: "Лейкоциты", names: ["лейкоциты", "wbc"] },
  { code: "platelets", label: "Тромбоциты", names: ["тромбоциты", "plt"] },
  { code: "hematocrit", label: "Гематокрит", names: ["гематокрит", "hct"] },
  { code: "mcv", label: "MCV", names: ["mcv", "средний объем эритроцита", "средний объём эритроцита"] },
  { code: "esr", label: "СОЭ", names: ["соэ", "esr", "скорость оседания эритроцитов"] },
  { code: "ferritin", label: "Ферритин", names: ["ферритин", "ferritin"] },
  { code: "iron", label: "Железо", names: ["железо", "сывороточное железо", "iron", "fe"] },
  { code: "transferrin_sat", label: "Насыщение трансферрина", names: ["насыщение трансферрина", "коэффициент насыщения трансферрина"] },
  { code: "b12", label: "Витамин B12", names: ["витамин b12", "витамин в12", "b12", "цианокобаламин", "кобаламин"] },
  { code: "folate", label: "Фолиевая кислота", names: ["фолиевая кислота", "фолат", "folate"] },
  { code: "vitamin_d", label: "Витамин D", names: ["витамин d", "витамин д", "25-oh", "25(oh)d", "25-он витамин d", "кальциферол"] },
  { code: "tsh", label: "ТТГ", names: ["ттг", "tsh", "тиреотропный гормон"] },
  { code: "t4_free", label: "Т4 свободный", names: ["т4 свободный", "ft4", "free t4", "свободный тироксин"] },
  { code: "t3_free", label: "Т3 свободный", names: ["т3 свободный", "ft3", "free t3"] },
  { code: "atpo", label: "Антитела к ТПО", names: ["антитела к тпо", "ат-тпо", "anti-tpo", "антитела к тиреопероксидазе"] },
  { code: "glucose", label: "Глюкоза", names: ["глюкоза", "glucose", "сахар крови"] },
  { code: "hba1c", label: "Гликированный гемоглобин", names: ["гликированный гемоглобин", "hba1c", "hb a1c"] },
  { code: "insulin", label: "Инсулин", names: ["инсулин", "insulin"] },
  { code: "cholesterol", label: "Холестерин общий", names: ["холестерин общий", "общий холестерин", "холестерин", "cholesterol total"] },
  { code: "ldl", label: "ЛПНП", names: ["лпнп", "ldl", "холестерин лпнп", "липопротеины низкой плотности"] },
  { code: "hdl", label: "ЛПВП", names: ["лпвп", "hdl", "холестерин лпвп", "липопротеины высокой плотности"] },
  { code: "triglycerides", label: "Триглицериды", names: ["триглицериды", "triglycerides", "тг"] },
  { code: "alt", label: "АЛТ", names: ["алт", "alt", "аланинаминотрансфераза"] },
  { code: "ast", label: "АСТ", names: ["аст", "ast", "аспартатаминотрансфераза"] },
  { code: "bilirubin_total", label: "Билирубин общий", names: ["билирубин общий", "общий билирубин"] },
  { code: "creatinine", label: "Креатинин", names: ["креатинин", "creatinine"] },
  { code: "urea", label: "Мочевина", names: ["мочевина", "urea"] },
  { code: "uric_acid", label: "Мочевая кислота", names: ["мочевая кислота", "uric acid"] },
  { code: "gfr", label: "СКФ", names: ["скф", "gfr", "скорость клубочковой фильтрации"] },
  { code: "crp", label: "С-реактивный белок", names: ["с-реактивный белок", "срб", "crp", "hs-crp"] },
  { code: "protein_total", label: "Белок общий", names: ["белок общий", "общий белок"] },
  { code: "albumin", label: "Альбумин", names: ["альбумин", "albumin"] },
  { code: "calcium", label: "Кальций", names: ["кальций", "calcium", "ca общий"] },
  { code: "magnesium", label: "Магний", names: ["магний", "magnesium", "mg"] },
  { code: "potassium", label: "Калий", names: ["калий", "potassium", "k+"] },
  { code: "sodium", label: "Натрий", names: ["натрий", "sodium", "na+"] },
  { code: "cortisol", label: "Кортизол", names: ["кортизол", "cortisol"] },
  { code: "prolactin", label: "Пролактин", names: ["пролактин", "prolactin"] },
  { code: "testosterone", label: "Тестостерон", names: ["тестостерон", "testosterone"] },
  { code: "estradiol", label: "Эстрадиол", names: ["эстрадиол", "estradiol", "e2"] },
  { code: "fsh", label: "ФСГ", names: ["фсг", "fsh"] },
  { code: "lh", label: "ЛГ", names: ["лг", "lh"] },
  { code: "amh", label: "АМГ", names: ["амг", "amh", "антимюллеров гормон"] },
  { code: "homocysteine", label: "Гомоцистеин", names: ["гомоцистеин", "homocysteine"] },
  { code: "blood_pressure", label: "Артериальное давление", names: ["артериальное давление", "ад", "давление"] },
];

function clean(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[.,;:()[\]«»"'*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Возвращает { code, label } для названия из документа.
export function normalizeMarker(rawName: string): { code: string; label: string } {
  const n = clean(rawName);
  if (!n) return { code: "unknown", label: rawName || "Показатель" };

  for (const s of SYNONYMS) {
    for (const cand of s.names) {
      const c = clean(cand);
      // Точное совпадение или название начинается с синонима (напр. «гемоглобин в эритроците»).
      if (n === c || n.startsWith(c + " ") || n.endsWith(" " + c)) return { code: s.code, label: s.label };
    }
  }
  // Не в словаре — делаем стабильный ключ из названия, чтобы динамика всё равно строилась.
  const slug = n.replace(/[^a-zа-я0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
  return { code: slug || "unknown", label: (rawName || "").trim() };
}

// Красивое имя показателя для интерфейса.
export function markerLabel(code: string, fallback: string): string {
  return SYNONYMS.find((s) => s.code === code)?.label || fallback;
}
