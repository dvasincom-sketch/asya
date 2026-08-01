// Профиль «о себе»: грани, которые человек заполняет сам, отвечая на мягкие вопросы.
// Это дополняет авто-память (факты из разговоров), а не заменяет её.

export type ProfileQuestion = { id: string; label: string; placeholder: string };
export type ProfileForm = { id: string; title: string; icon: string; blurb: string; questions: ProfileQuestion[] };

export const PROFILE_FORMS: ProfileForm[] = [
  {
    id: "hello",
    title: "Знакомство",
    icon: "🌸",
    blurb: "Как к тебе обращаться и на каком ты этапе.",
    questions: [
      { id: "name", label: "Как тебя зовут и как обращаться — она или он?", placeholder: "Например: Марина, в женском роде" },
      { id: "stage", label: "Сколько тебе лет или какой это этап жизни?", placeholder: "Возраст или просто «мама двоих», «студентка»…" },
      { id: "place", label: "Откуда ты и где живёшь сейчас?", placeholder: "Город, страна — как хочется" },
    ],
  },
  {
    id: "work",
    title: "Работа и дело",
    icon: "💼",
    blurb: "Чем занимаешься и как тебе в этом.",
    questions: [
      { id: "what", label: "Чем ты занимаешься?", placeholder: "Профессия, дело, учёба" },
      { id: "feel", label: "Что в работе радует, а что выматывает?", placeholder: "Что даёт силы, а что забирает" },
      { id: "goal", label: "Есть ли цель или мечта в деле сейчас?", placeholder: "К чему идёшь" },
    ],
  },
  {
    id: "close",
    title: "Близкие и отношения",
    icon: "💗",
    blurb: "Кто рядом и что для тебя важно.",
    questions: [
      { id: "people", label: "Кто твои самые близкие?", placeholder: "Партнёр, дети, друзья, родители" },
      { id: "status", label: "Как сейчас в отношениях или семье?", placeholder: "Как хочется рассказать" },
      { id: "pets", label: "Есть ли питомцы?", placeholder: "Кто и как зовут" },
    ],
  },
  {
    id: "care",
    title: "Забота о себе",
    icon: "🕊",
    blurb: "Что тебя восстанавливает и держит.",
    questions: [
      { id: "restore", label: "Что тебя восстанавливает и радует?", placeholder: "Что наполняет" },
      { id: "goodday", label: "Как выглядит твой хороший день?", placeholder: "Опиши, как получается" },
      { id: "hard", label: "Что помогает, когда тяжело?", placeholder: "Что поддерживает" },
    ],
  },
  {
    id: "body",
    title: "Тело и ритм",
    icon: "🌿",
    blurb: "Сон, энергия, отношение к телу. Без диагнозов.",
    questions: [
      { id: "sleep", label: "Как у тебя со сном и энергией?", placeholder: "Высыпаешься ли, когда сил больше или меньше" },
      { id: "keep", label: "О чём заботишься в здоровье?", placeholder: "Питание, движение, отдых — без диагнозов" },
      { id: "body", label: "Как относишься к своему телу?", placeholder: "Как чувствуешь" },
    ],
  },
  {
    id: "values",
    title: "Что мне важно",
    icon: "✨",
    blurb: "Ценности и к чему стремишься.",
    questions: [
      { id: "main", label: "Что для тебя сейчас самое важное?", placeholder: "Что в центре" },
      { id: "values", label: "Какие ценности тебе близки?", placeholder: "Что важно по-настоящему" },
      { id: "strive", label: "К чему стремишься в ближайшее время?", placeholder: "Планы, желания" },
    ],
  },
  {
    id: "self",
    title: "Характер и чувства",
    icon: "🌊",
    blurb: "Какой ты и что на тебя влияет.",
    questions: [
      { id: "describe", label: "Как ты себя опишешь?", placeholder: "Несколько слов о себе" },
      { id: "trigger", label: "Что чаще всего выбивает из колеи?", placeholder: "Что задевает" },
      { id: "calm", label: "Что тебя успокаивает?", placeholder: "Что возвращает опору" },
    ],
  },
];

export function getForm(id: string): ProfileForm | null {
  return PROFILE_FORMS.find((f) => f.id === id) ?? null;
}

// Компактная справка для system-prompt — то, что человек рассказал о себе сам.
export function buildProfileContext(rows: { formId: string; questionId: string; value: string }[]): string {
  if (!rows.length) return "";
  const byForm = new Map<string, { title: string; items: string[] }>();
  for (const r of rows) {
    const form = getForm(r.formId);
    if (!form) continue;
    const q = form.questions.find((x) => x.id === r.questionId);
    if (!q || !r.value) continue;
    const entry = byForm.get(form.id) || { title: form.title, items: [] };
    entry.items.push(`${q.label} — ${r.value}`);
    byForm.set(form.id, entry);
  }
  if (!byForm.size) return "";
  const blocks = [...byForm.values()].map((f) => `${f.title}: ${f.items.join("; ")}`).join("\n");
  return (
    "\n\nЧто человек сам рассказал о себе (помни это и обращайся бережно, вплетай естественно, " +
    "не зачитывай списком):\n" + blocks
  );
}
