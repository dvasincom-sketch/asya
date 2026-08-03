// Ядро сети «Ася — доверенный посредник».
// Строгая СТЕНА: брокерить можно ТОЛЬКО явный активный оффер в live-категории при согласии.
// Ася никогда не рекомендует из личных разговоров/инкогнито по своему усмотрению.
// Черновики офферов/запросов пишутся в БД только после явного согласия человека (в роутах).

export type NetCategory = "service" | "nanny" | "dating";

export const CATEGORIES: Record<
  NetCategory,
  { label: string; icon: string; live: boolean; needsVerify: boolean; minAge?: number; note: string }
> = {
  service: {
    label: "Услуги и навыки",
    icon: "🛠",
    live: true,
    needsVerify: false,
    note: "Тренер, репетитор, мастер, психолог и т.п. Самая безопасная категория — стартуем с неё.",
  },
  nanny: {
    label: "Няни",
    icon: "🧸",
    live: false, // предохранитель: живой обмен закрыт, пока нет верификации/дисклеймеров/права
    needsVerify: true,
    note: "Дети — реальный риск. Нужны верификация, дисклеймеры и правовое ревью до запуска.",
  },
  dating: {
    label: "Знакомства",
    icon: "💗",
    live: false, // предохранитель: закрыт, пока нет 18+, верификации фото, жалоб/блока, гайда безопасности
    needsVerify: true,
    minAge: 18,
    note: "18+, верификация фото, жалобы/блок, безопасность встреч. Открываем последней.",
  },
};

export type OfferStatus = "draft" | "active" | "paused";
export type RequestStatus = "open" | "matched" | "closed" | "expired";
export type IntroStatus =
  | "proposed"
  | "candidate_accepted"
  | "candidate_declined"
  | "requester_selected"
  | "contact_shared"
  | "closed";

// Разрешён ли живой обмен по категории. Услуги — да; няни/знакомства — только когда
// готова безопасность (снимается переменной окружения NETWORK_<CAT>_LIVE=1).
// Глобальный рубильник: NETWORK_ENABLED=0 гасит всё.
export function categoryLive(cat: string): boolean {
  const c = CATEGORIES[cat as NetCategory];
  if (!c) return false;
  if (process.env.NETWORK_ENABLED === "0") return false;
  const override = process.env[`NETWORK_${cat.toUpperCase()}_LIVE`];
  if (override === "1") return true;
  if (override === "0") return false;
  return c.live;
}

export function isCategory(cat: string): cat is NetCategory {
  return cat === "service" || cat === "nanny" || cat === "dating";
}

// Стена: брокерить можно только явный активный оффер в live-категории при согласии.
export function canBroker(opts: { category: string; offerStatus: string; consentEnabled: boolean }): boolean {
  return categoryLive(opts.category) && opts.offerStatus === "active" && opts.consentEnabled === true;
}

// --- Скелет матчинга (чистая функция, без БД) ------------------------------
export type OfferLite = { id: string; userId: string; category: string; status: string; params?: string | null };
export type RequestLite = { id: string; userId: string; category: string; criteria?: string | null };

function parseJson(json?: string | null): Record<string, unknown> {
  if (!json) return {};
  try {
    const o = JSON.parse(json);
    return o && typeof o === "object" ? (o as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

// Базовый матч: та же категория, активный оффер, не свой же, грубое совпадение по городу/локации.
// Дальше сюда добавятся цена, доступность, возраст, проф-критерии.
export function matchOffers(request: RequestLite, offers: OfferLite[]): OfferLite[] {
  const cr = parseJson(request.criteria);
  const city = String(cr.city ?? cr.location ?? "").toLowerCase().trim();
  return offers.filter((o) => {
    if (o.category !== request.category) return false;
    if (o.status !== "active") return false;
    if (o.userId === request.userId) return false;
    if (city) {
      const op = parseJson(o.params);
      const ocity = String(op.city ?? op.location ?? "").toLowerCase();
      if (ocity && !ocity.includes(city) && !city.includes(ocity)) return false;
    }
    return true;
  });
}
