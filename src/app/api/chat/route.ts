import { NextRequest } from "next/server";
import { detectCrisis, CRISIS_REPLY, type ChatMessage } from "@/lib/crisis";
import { streamChat, hasKey } from "@/lib/timeweb";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { usageKey, checkAndCount, ANON_LIMIT, USER_LIMIT } from "@/lib/ratelimit";
import { rememberFrom } from "@/lib/memory";
import { asksAboutServices, buildProgramsContext, asksLogistics, buildSalonInfoContext } from "@/lib/salonKnowledge";
import { SALON } from "@/lib/salon";
import { getSkill, buildSkillContext } from "@/lib/skills";
import { searchChannels, selectChannels, extractSearchSpec, type CatalogChannel } from "@/lib/tgcatalog";
import { drawCards, buildTaroContext, wantsDraw, drawCount } from "@/lib/tarot";
import { buildProfileContext } from "@/lib/profileForms";
import { getSub, retentionSince } from "@/lib/plus";
import { g, detectGenderFromText, detectGenderFromFacts, setGenderIfEmpty, type Gender } from "@/lib/address";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { messages?: ChatMessage[] } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request", text: "Некорректный запрос." }, { status: 400 });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  const lastUser = [...messages].reverse().find((m) => m.role === "user");

  // Навык, в режиме которого идёт разговор (null = обычная Ася).
  const rawSkill = (body as { skill?: unknown }).skill;
  const skill = getSkill(typeof rawSkill === "string" ? rawSkill : null);
  const skillId = skill?.id ?? null;

  // Инкогнито: этот разговор нигде не сохраняем (ни история, ни память, ни кризис-флаг).
  // Но то, что Ася уже знает о человеке, по-прежнему подмешиваем — она остаётся собой.
  const incognito = (body as { incognito?: unknown }).incognito === true;

  // Таро: расклад — эфемерный ритуал (не сохраняем в историю). Карты тянем заранее.
  let taroCards: string[] = [];
  if (skill?.id === "taro" && lastUser && wantsDraw(String(lastUser.content))) {
    taroCards = drawCards(drawCount(String(lastUser.content))).map((c) => c.id);
  }

  // Текущий пользователь (если вошёл). Для анонимных — быстро вернёт null, без БД.
  const user = await getCurrentUser().catch(() => null);
  const saveHistory = Boolean(user && user.historyEnabled && !incognito && !taroCards.length);
  const saveMemory = Boolean(user && user.memoryEnabled && !incognito && !taroCards.length);

  // Забота+: полная память; бесплатно — только последнее окно (когда оплата настроена).
  const memSince = user ? retentionSince(await getSub(user.id).catch(() => null)) : null;

  // Prisma-клиент в песочнице собран без поля skill — тегируем сообщения через приведение типов.
  const msgDb = prisma.message as unknown as {
    create: (a: { data: { userId: string; role: string; content: string; skill?: string | null } }) => Promise<unknown>;
  };

  // Кризисный путь — модель не вызываем и лимит не применяем (безопасность важнее).
  if (lastUser && detectCrisis(String(lastUser.content))) {
    if (saveHistory && user) {
      await msgDb.create({ data: { userId: user.id, role: "user", content: String(lastUser.content), skill: skillId } }).catch(() => {});
    }
    if (user && !incognito) await prisma.crisisEvent.create({ data: { userId: user.id, level: "keyword" } }).catch(() => {});
    return Response.json(CRISIS_REPLY);
  }

  // Серверный дневной лимит: аноним — по IP, вошедший — по userId.
  if (lastUser) {
    const key = usageKey(req, user?.id);
    const limit = user ? USER_LIMIT : ANON_LIMIT;
    const { allowed } = await checkAndCount(key, limit);
    if (!allowed) {
      return Response.json(
        {
          error: "limit",
          needAuth: !user,
          text: user
            ? "На сегодня достаточно — я никуда не денусь. Давай продолжим завтра 🤍"
            : "Мы с тобой хорошо поговорили сегодня. Войди — и я сохраню наш разговор, чтобы завтра продолжить с того же места. Это бесплатно.",
        },
        { status: 429 },
      );
    }
  }

  // Сохраняем сообщение пользователя (после лимита — чтобы не копить заблокированные).
  if (saveHistory && user && lastUser) {
    await msgDb.create({ data: { userId: user.id, role: "user", content: String(lastUser.content), skill: skillId } }).catch(() => {});
  }

  if (!hasKey()) {
    return Response.json({ error: "no_key", text: "Ключ модели не задан." }, { status: 503 });
  }

  // Навык «Найти канал»: не поток, а структурный ответ — Ася подбирает каналы,
  // клиент рисует их кликабельными плашками (перейти в Telegram в один тап).
  if (skill?.id === "tgguide" && lastUser) {
    const query = String(lastUser.content);
    // TGStat ищет по словам в названии/описании — сырую фразу он не понимает. Сначала
    // извлекаем из разговора чистый запрос (тема + город) и тип (сообщество/канал).
    const spec = await extractSearchSpec(messages).catch(() => ({ q: query, peerType: "all" as const, category: "", isSearch: true, broadQ: "" }));
    let picked: { intro: string; channels: CatalogChannel[] };
    if (!spec.isSearch) {
      // Не поиск (вопрос о возможностях, приветствие) — навык остаётся собой, но не ищет впустую.
      console.warn("[tgstat] не-поисковое сообщение — отвечаю о возможностях");
      picked = {
        intro:
          "Я умею находить телеграм-каналы и чаты по теме 🤍 Скажи, что ищешь: тему (например, бег, мамы, новости про ИИ), " +
          "и если важно — город и что нужно, канал с контентом или чат-сообщество. Тогда подберу самое подходящее.",
        channels: [],
      };
    } else {
      // Попытка 1 — точный запрос (тема + город + тип + категория).
      let found = await searchChannels(spec.q, spec.peerType, spec.category).catch(() => ({ items: [] as CatalogChannel[], available: false }));
      console.warn(`[tgstat] try1 spec=${JSON.stringify(spec)} candidates=${found.items.length} available=${found.available}`);
      // Мало результатов — авто-расширение: общий ключ (broadQ), любой тип, без категории.
      if (found.available && found.items.length < 3 && spec.broadQ && spec.broadQ !== spec.q) {
        const broad = await searchChannels(spec.broadQ, "all", "").catch(() => ({ items: [] as CatalogChannel[], available: false }));
        console.warn(`[tgstat] try2(broad) q="${spec.broadQ}" candidates=${broad.items.length}`);
        if (broad.available && broad.items.length > found.items.length) found = broad;
      }
      if (!found.available) {
        // Сбой уровня каталога (нет токена/подписки, сеть) — честно, а не «ничего не нашлось».
        picked = { intro: "Каталог каналов сейчас недоступен — не хочу выдумывать, вернёмся к поиску чуть позже 🤍", channels: [] };
      } else {
        // Для отбора отдаём распознанный интент (spec.q) — по нему модель судит релевантность точнее.
        picked = await selectChannels(spec.q || query, found.items).catch(() => ({
          intro: "Не получилось поискать сейчас — попробуй ещё раз чуть позже 🤍",
          channels: [] as CatalogChannel[],
        }));
        console.warn(`[tgstat] показано каналов: ${picked.channels.length}`);
      }
    }
    if (saveHistory && user) {
      await msgDb.create({ data: { userId: user.id, role: "assistant", content: picked.intro, skill: skillId } }).catch(() => {});
    }
    if (saveMemory && user && query) void rememberFrom(user.id, query);
    return Response.json({ type: "tgchannels", text: picked.intro, channels: picked.channels });
  }

  // Память: что Ася уже знает о человеке — подмешиваем в system-prompt.
  let systemExtra = "";
  if (user && user.memoryEnabled) {
    const mems = await prisma.memory
      .findMany({
        where: { userId: user.id, ...(memSince ? { createdAt: { gte: memSince } } : {}) },
        take: 40,
        orderBy: { createdAt: "desc" },
      })
      .catch(() => [] as { fact: string }[]);
    if (mems.length) {
      systemExtra =
        "\n\nЧто ты уже знаешь об этом человеке (помни это и обращайся бережно, не перечисляй списком): " +
        mems.map((m: { fact: string }) => m.fact).join("; ");
    }

    // Род обращения — единый системный источник. Берём из User.gender, иначе восстанавливаем
    // из текущего сообщения и уже известных фактов, сохраняем и жёстко фиксируем в промпте,
    // чтобы Ася обращалась к человеку в верном роде на всех этапах.
    let gender: Gender = (user as unknown as { gender?: Gender }).gender ?? null;
    if (gender !== "male" && gender !== "female") {
      gender = detectGenderFromText(String(lastUser?.content ?? "")) || detectGenderFromFacts(mems.map((m: { fact: string }) => m.fact));
      if (gender && !incognito) await setGenderIfEmpty(user.id, gender).catch(() => {});
    }
    if (gender === "male" || gender === "female") {
      systemExtra +=
        `\n\nВАЖНО про обращение: обращайся к человеку строго в ${g(gender, "женском", "мужском")} роде ` +
        `во всех формах (глаголы, прилагательные, причастия). Про себя Ася — в женском роде, это не меняется.`;
    }
  }

  // Профиль «о себе» — то, что человек заполнил сам. Уважает тот же тумблер памяти;
  // в инкогнито (как и авто-память) читается, но ничего не пишется.
  if (user && user.memoryEnabled) {
    const paRows = await (
      prisma as unknown as {
        profileAnswer: {
          findMany: (a: { where: { userId: string } }) => Promise<{ formId: string; questionId: string; value: string }[]>;
        };
      }
    ).profileAnswer
      .findMany({ where: { userId: user.id } })
      .catch(() => [] as { formId: string; questionId: string; value: string }[]);
    systemExtra += buildProfileContext(paRows);
  }

  // Спросили про программы салона — подмешиваем справку, чтобы Ася не выдумывала.
  if (SALON.enabled && !skill && !incognito && lastUser && asksAboutServices(String(lastUser.content))) {
    systemExtra += buildProgramsContext();
  }

  // Администратор салона: логистика и подготовка — тоже строго по справке.
  if (SALON.enabled && !skill && !incognito && lastUser && asksLogistics(String(lastUser.content))) {
    systemExtra += buildSalonInfoContext();
  }

  // Навык: подмешиваем грунтовку (метод, границы, справку), чтобы Ася держалась темы и не фантазировала.
  if (skill) systemExtra += buildSkillContext(skill);

  // Таро: подмешиваем значения выпавших карт (сам расклад вытянут заранее, выше).
  if (taroCards.length) systemExtra += buildTaroContext(taroCards);

  try {
    // Модели отдаём только последнее окно переписки — контекст не пухнет с ростом истории.
    // Долгую память несёт отдельный механизм фактов (systemExtra выше).
    const CONTEXT_WINDOW = 40;
    const context = messages.slice(-CONTEXT_WINDOW);
    const upstream = await streamChat(context, systemExtra);
    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => "");
      console.error(`[api/chat] Модель ответила ошибкой ${upstream.status}: ${detail.slice(0, 800)}`);
      return Response.json(
        { error: "upstream", text: "Не получилось связаться с моделью.", detail: detail.slice(0, 500) },
        { status: 502 },
      );
    }

    // Прокидываем поток в браузер и параллельно копим ответ, чтобы сохранить в историю.
    const reader = upstream.body.getReader();
    const dec = new TextDecoder();
    const uid = user?.id;
    const userText = lastUser ? String(lastUser.content) : "";
    let full = "";
    let buf = "";
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) {
          if (saveHistory && uid && full) {
            await msgDb.create({ data: { userId: uid, role: "assistant", content: full, skill: skillId } }).catch(() => {});
          }
          controller.close();
          // Авто-память: извлекаем факты из реплики пользователя (не блокирует поток).
          if (saveMemory && uid && userText) void rememberFrom(uid, userText);
          return;
        }
        controller.enqueue(value);
        buf += dec.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const evt = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          for (const line of evt.split("\n")) {
            const l = line.trim();
            if (!l.startsWith("data:")) continue;
            const p = l.slice(5).trim();
            if (p === "[DONE]") continue;
            try {
              const j = JSON.parse(p);
              const d = j?.choices?.[0]?.delta?.content;
              if (d) full += d;
            } catch {
              /* неполный фрагмент */
            }
          }
        }
      },
      cancel() {
        reader.cancel().catch(() => {});
      },
    });

    const headers: Record<string, string> = {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    };
    if (taroCards.length) headers["X-Taro-Cards"] = taroCards.join(",");
    return new Response(stream, { headers });
  } catch (e) {
    console.error("[api/chat] Не удалось выполнить запрос к модели:", e);
    return Response.json({ error: "server", text: "Что-то пошло не так на сервере." }, { status: 500 });
  }
}
