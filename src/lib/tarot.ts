// Полная колода Таро (78 карт) для навыка «Таро».
// Рисуем карты своим дизайном: глиф — это внутренняя разметка SVG (viewBox 0 0 100 100),
// стиль (обводка акцентом, свечение) задаёт globals.css. Значения — краткие, для толкования моделью.
// Основа списка и значений — общедоступная система Райдер–Уэйт–Смит.

export type TarotCard = { id: string; ru: string; en: string; num: string; glyph: string; meaning: string };

// --- Старшие арканы (22) --------------------------------------------------
const MAJORS: TarotCard[] = [
  { id: "fool", ru: "Дурак", en: "The Fool", num: "0", meaning: "начало, свобода, доверие к пути, прыжок в неизвестное",
    glyph: '<circle cx="34" cy="34" r="7"/><line x1="30" y1="72" x2="66" y2="30"/><path d="M64 26 q9 -4 11 5 q-3 7 -11 4 z"/>' },
  { id: "magician", ru: "Маг", en: "The Magician", num: "I", meaning: "воля, умение, воплощение замысла, всё под рукой",
    glyph: '<path d="M38 34 a8 6 0 1 0 12 0 a8 6 0 1 0 12 0"/><line x1="50" y1="42" x2="50" y2="76"/>' },
  { id: "high-priestess", ru: "Верховная Жрица", en: "The High Priestess", num: "II", meaning: "интуиция, тайна, внутреннее знание, тишина",
    glyph: '<line x1="34" y1="26" x2="34" y2="78"/><line x1="66" y1="26" x2="66" y2="78"/><path d="M42 40 a10 10 0 1 0 16 0 a13 13 0 0 1 -16 0 z"/>' },
  { id: "empress", ru: "Императрица", en: "The Empress", num: "III", meaning: "изобилие, забота, женственность, творчество, природа",
    glyph: '<circle cx="50" cy="40" r="14"/><line x1="50" y1="54" x2="50" y2="80"/><line x1="38" y1="66" x2="62" y2="66"/>' },
  { id: "emperor", ru: "Император", en: "The Emperor", num: "IV", meaning: "опора, структура, власть, защита, порядок",
    glyph: '<path d="M34 44 q6 -14 16 0 q10 -14 16 0"/><rect x="36" y="46" width="28" height="30" rx="2"/>' },
  { id: "hierophant", ru: "Иерофант", en: "The Hierophant", num: "V", meaning: "традиция, наставник, смысл, вера, правила",
    glyph: '<line x1="50" y1="24" x2="50" y2="72"/><line x1="40" y1="34" x2="60" y2="34"/><line x1="42" y1="44" x2="58" y2="44"/><line x1="40" y1="72" x2="60" y2="72"/>' },
  { id: "lovers", ru: "Влюблённые", en: "The Lovers", num: "VI", meaning: "любовь, выбор сердцем, союз, притяжение",
    glyph: '<path d="M40 44 q-8 -12 -16 0 q-2 10 16 18 q18 -8 16 -18 q-8 -12 -16 0 z" transform="translate(9 4) scale(0.9)"/>' },
  { id: "chariot", ru: "Колесница", en: "The Chariot", num: "VII", meaning: "воля, движение вперёд, победа через собранность",
    glyph: '<rect x="32" y="34" width="36" height="20" rx="3"/><circle cx="40" cy="66" r="8"/><circle cx="60" cy="66" r="8"/>' },
  { id: "strength", ru: "Сила", en: "Strength", num: "VIII", meaning: "мягкая сила, терпение, кротость укрощает",
    glyph: '<path d="M34 50 a8 6 0 1 0 12 0 a8 6 0 1 0 12 0"/><path d="M34 62 q16 12 32 0"/>' },
  { id: "hermit", ru: "Отшельник", en: "The Hermit", num: "IX", meaning: "уединение, поиск истины внутри, свет в темноте",
    glyph: '<path d="M40 30 h20 l4 20 h-28 z"/><path d="M50 36 l4 8 l-8 0 z" class="dot"/><line x1="64" y1="30" x2="64" y2="78"/>' },
  { id: "wheel", ru: "Колесо Фортуны", en: "Wheel of Fortune", num: "X", meaning: "перемены, циклы, поворот судьбы, удача",
    glyph: '<circle cx="50" cy="50" r="22"/><circle cx="50" cy="50" r="6"/><line x1="50" y1="28" x2="50" y2="72"/><line x1="28" y1="50" x2="72" y2="50"/><line x1="34" y1="34" x2="66" y2="66"/><line x1="66" y1="34" x2="34" y2="66"/>' },
  { id: "justice", ru: "Справедливость", en: "Justice", num: "XI", meaning: "честность, равновесие, причина и следствие, правда",
    glyph: '<line x1="50" y1="26" x2="50" y2="74"/><line x1="30" y1="38" x2="70" y2="38"/><path d="M30 38 l-6 12 h12 z"/><path d="M70 38 l-6 12 h12 z"/>' },
  { id: "hanged-man", ru: "Повешенный", en: "The Hanged Man", num: "XII", meaning: "пауза, взгляд иначе, отпускание, принятие",
    glyph: '<line x1="30" y1="26" x2="70" y2="26"/><line x1="55" y1="26" x2="55" y2="44"/><path d="M55 44 l-12 22 h24 z"/>' },
  { id: "death", ru: "Смерть", en: "Death", num: "XIII", meaning: "завершение и обновление, конец ради нового начала",
    glyph: '<circle cx="50" cy="46" r="9"/><line x1="50" y1="55" x2="50" y2="78"/><path d="M40 40 q10 -14 20 0"/><path d="M42 66 q8 8 16 0"/>' },
  { id: "temperance", ru: "Умеренность", en: "Temperance", num: "XIV", meaning: "баланс, мера, исцеление, спокойное течение",
    glyph: '<path d="M32 40 h14 l-4 12 a10 10 0 0 1 -6 -12 z"/><path d="M54 48 h14 l-4 12 a10 10 0 0 1 -6 -12 z"/><path d="M46 46 q4 6 8 4"/>' },
  { id: "devil", ru: "Дьявол", en: "The Devil", num: "XV", meaning: "привязанность, соблазн, то, что держит; честно увидеть",
    glyph: '<path d="M36 34 q-6 -10 -2 -14"/><path d="M64 34 q6 -10 2 -14"/><circle cx="50" cy="46" r="12"/><path d="M44 66 a6 6 0 0 0 12 0"/>' },
  { id: "tower", ru: "Башня", en: "The Tower", num: "XVI", meaning: "внезапный слом, освобождение от ложного, встряска",
    glyph: '<rect x="40" y="38" width="20" height="40"/><path d="M40 38 l10 -12 l10 12"/><path d="M50 44 l-6 12 l8 -2 l-4 12"/>' },
  { id: "star", ru: "Звезда", en: "The Star", num: "XVII", meaning: "надежда, вдохновение, исцеление, вера в лучшее",
    glyph: '<path d="M50 22 L56 44 L78 44 L60 58 L67 80 L50 66 L33 80 L40 58 L22 44 L44 44 Z"/><circle class="dot" cx="26" cy="26" r="1.8"/><circle class="dot" cx="76" cy="30" r="1.8"/>' },
  { id: "moon", ru: "Луна", en: "The Moon", num: "XVIII", meaning: "чувства, интуиция, тревога и тайна, слушать сны",
    glyph: '<path d="M64 22 A32 32 0 1 0 64 78 A24 24 0 1 1 64 22 Z"/><circle class="dot" cx="30" cy="34" r="1.8"/><circle class="dot" cx="70" cy="64" r="1.6"/>' },
  { id: "sun", ru: "Солнце", en: "The Sun", num: "XIX", meaning: "радость, ясность, тепло, успех, лёгкость",
    glyph: '<circle cx="50" cy="50" r="18"/><path d="M50 14 L50 24 M50 76 L50 86 M14 50 L24 50 M76 50 L86 50 M24 24 L31 31 M69 69 L76 76 M76 24 L69 31 M31 69 L24 76"/>' },
  { id: "judgement", ru: "Суд", en: "Judgement", num: "XX", meaning: "пробуждение, зов, переоценка, второе дыхание",
    glyph: '<path d="M30 44 l22 -8 v20 z"/><path d="M60 40 q8 6 0 16"/><path d="M66 36 q14 10 0 24"/>' },
  { id: "world", ru: "Мир", en: "The World", num: "XXI", meaning: "завершение, целостность, гармония, достижение",
    glyph: '<ellipse cx="50" cy="50" rx="18" ry="26"/><circle class="dot" cx="50" cy="22" r="2"/><circle class="dot" cx="50" cy="78" r="2"/><circle class="dot" cx="30" cy="50" r="2"/><circle class="dot" cx="70" cy="50" r="2"/>' },
];

// --- Младшие арканы (56): 4 масти × 14 рангов ------------------------------
const SUITS: { key: string; gen: string; en: string; theme: string; glyph: string }[] = [
  { key: "wands", gen: "Жезлов", en: "Wands", theme: "энергия, действие, желание, творчество",
    glyph: '<line x1="50" y1="20" x2="50" y2="80"/><path d="M50 22 q11 6 6 17"/><path d="M50 33 q-10 5 -6 15"/>' },
  { key: "cups", gen: "Кубков", en: "Cups", theme: "чувства, отношения, близость, душа",
    glyph: '<path d="M32 34 h36 a18 16 0 0 1 -36 0 z"/><line x1="50" y1="50" x2="50" y2="70"/><line x1="38" y1="72" x2="62" y2="72"/>' },
  { key: "swords", gen: "Мечей", en: "Swords", theme: "мысли, слова, решения, тревоги, ясность",
    glyph: '<line x1="50" y1="18" x2="50" y2="64"/><line x1="38" y1="60" x2="62" y2="60"/><path class="dot" d="M50 64 l-5 9 h10 z"/>' },
  { key: "pentacles", gen: "Пентаклей", en: "Pentacles", theme: "дело, деньги, тело, быт, результат",
    glyph: '<circle cx="50" cy="50" r="22"/><path d="M50 30 L56 48 L74 48 L60 60 L65 78 L50 67 L35 78 L40 60 L26 48 L44 48 Z"/>' },
];

const RANKS: { key: string; word: string; en: string; num: string; meaning: string }[] = [
  { key: "ace", word: "Туз", en: "Ace", num: "Туз", meaning: "начало, чистый потенциал" },
  { key: "2", word: "Двойка", en: "Two", num: "2", meaning: "выбор, равновесие, партнёрство" },
  { key: "3", word: "Тройка", en: "Three", num: "3", meaning: "первые плоды, рост" },
  { key: "4", word: "Четвёрка", en: "Four", num: "4", meaning: "опора, стабильность, пауза" },
  { key: "5", word: "Пятёрка", en: "Five", num: "5", meaning: "испытание, перемена, потеря" },
  { key: "6", word: "Шестёрка", en: "Six", num: "6", meaning: "гармония, помощь, движение к лучшему" },
  { key: "7", word: "Семёрка", en: "Seven", num: "7", meaning: "проверка, выбор, терпение" },
  { key: "8", word: "Восьмёрка", en: "Eight", num: "8", meaning: "скорость, движение, мастерство" },
  { key: "9", word: "Девятка", en: "Nine", num: "9", meaning: "почти у цели, зрелость" },
  { key: "10", word: "Десятка", en: "Ten", num: "10", meaning: "полнота, завершение, итог" },
  { key: "page", word: "Паж", en: "Page", num: "Паж", meaning: "любопытство, весть, начало пути" },
  { key: "knight", word: "Рыцарь", en: "Knight", num: "Рыцарь", meaning: "порыв, движение, действие" },
  { key: "queen", word: "Дама", en: "Queen", num: "Дама", meaning: "зрелость, забота, внутренняя сила" },
  { key: "king", word: "Король", en: "King", num: "Король", meaning: "мастерство, ответственность, власть" },
];

const MINORS: TarotCard[] = SUITS.flatMap((s) =>
  RANKS.map((r) => ({
    id: `${s.key}-${r.key}`,
    ru: `${r.word} ${s.gen}`,
    en: `${r.en} of ${s.en}`,
    num: r.num,
    glyph: s.glyph,
    meaning: `${s.theme}: ${r.meaning}`,
  })),
);

export const CARDS: TarotCard[] = [...MAJORS, ...MINORS];
const CARD_MAP = new Map(CARDS.map((c) => [c.id, c]));

export function getCard(id: string): TarotCard | null {
  return CARD_MAP.get(id) ?? null;
}

// Вытянуть n различных карт случайно.
export function drawCards(n: number): TarotCard[] {
  const pool = [...CARDS];
  const out: TarotCard[] = [];
  const count = Math.max(1, Math.min(n, 5));
  for (let i = 0; i < count && pool.length; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

// Похоже, что человек просит расклад/карту.
export function wantsDraw(text: string): boolean {
  return /(тян|карт|расклад|погадай|выпад|гадани|что\s+(меня|мне|ждёт|ждет|будет|впереди)|как\s+(сложит|будет)|\?)/i.test(
    text || "",
  );
}

// Сколько карт тянуть.
export function drawCount(text: string): number {
  return /(расклад|три\s+карт|прошл|настоящ|будущ|3\s+карт)/i.test(text || "") ? 3 : 1;
}

// Грунтовка для промпта: какие карты выпали и что с ними делать.
export function buildTaroContext(ids: string[]): string {
  const cards = ids.map((id) => getCard(id)).filter((c): c is TarotCard => Boolean(c));
  if (!cards.length) return "";
  const one = cards.length === 1;
  const lines = cards.map((c) => `«${c.ru}» (${c.en}) — ${c.meaning}`).join("\n");
  return (
    `\n\nСейчас ты вытягиваешь для человека ${one ? "карту" : "карты"}:\n${lines}\n` +
    `Истолкуй ${one ? "её" : "их"} тепло и образно применительно к тому, что человека занимает, свяжи с его чувствами и жизнью, ` +
    `живым текстом без списков. Не называй других карт и не выдумывай новых — говори именно об ${one ? "этой карте" : "этих картах"}. ` +
    `Заверши мягким вопросом. Помни: таро — это повод подумать и развлечение, а не предсказание судьбы.`
  );
}
