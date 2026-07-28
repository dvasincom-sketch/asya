"use client";

import { useState } from "react";
import { Orb } from "./Orb";

type Saved =
  | { type: "canvas"; body: [string, string][]; title: string; date: string }
  | { type: "points"; body: string[]; title: string; date: string };

type Theme = {
  id: string; ic: string; name: string; line: string; meta: string; big?: boolean;
  sub: string; summary: string; insights: string[]; saved?: Saved[]; moments: [string, string][];
};

const THEMES: Theme[] = [
  { id: "work", ic: "💼", name: "Работа", line: "Выгорание и границы — как не растворяться в работе.", meta: "14 разговоров · обновлено 3 дня назад", big: true,
    sub: "Выгорание и границы",
    summary: "Ты много вкладываешься, и тебе трудно останавливаться. Усталость копится к концу недели — и чаще всего дело не в задачах, а в том, что для себя не остаётся места.",
    insights: ["Тяжелее всего — пятницы и созвоны.", "Тебе легчает, когда получается сказать «нет» без чувства вины.", "В глубине хочешь работу, где заботишься о людях, но без выгорания."],
    saved: [{ type: "points", title: "Ретроспектива за 3 месяца", date: "3 дня назад", body: ["Много вложила — и гордишься проектом, и вымоталась.", "Круг: берёшь на себя → выгораешь → винишь себя.", "Ты впервые сказала «нет» — поворот начался.", "Шаг: останавливаться раньше, чем упадёшь."] }],
    moments: [["3 дня назад", "Снова не успела ничего для себя — разбирали, почему так трудно остановиться."], ["14 июля", "Впервые сказала коллеге «нет». Было страшно, но потом стало легче."], ["28 июня", "Думала уволиться — смотрели, что именно не так, а что держит."]] },
  { id: "rel", ic: "💗", name: "Отношения", line: "Про близость и про то, чтобы тебя слышали.", meta: "9 разговоров",
    sub: "Близость и быть услышанной",
    summary: "Тебе важно чувствовать, что тебя правда слышат. Иногда проще позаботиться о другом, чем попросить о себе — и от этого копится обида, которую трудно назвать.",
    insights: ["Обиду замечаешь не сразу — сначала «всё нормально».", "Тепло чувствуешь через внимание к мелочам, а не громкие слова."],
    moments: [["5 дней назад", "Поговорили о том, как просить близких о поддержке."], ["2 июля", "Ссора, после которой было важно, что тебя наконец услышали."]] },
  { id: "dreams", ic: "🌙", name: "Сны", line: "Повторяются про опоздания и поиск.", meta: "6 снов",
    sub: "Твои повторяющиеся сны",
    summary: "В снах часто мотив опоздания и поиска — будто внутри есть страх что-то упустить или не успеть быть «достаточно хорошей». Они приходят в загруженные недели.",
    insights: ["Сон про поезд — когда наяву гонка и нет паузы.", "После того как проговорим сон, тревога от него спадает."],
    moments: [["вчера", "Поезд и потерянный билет — проснулась на нервах."], ["20 июня", "Искала дом и не могла найти — говорили про «где твоё место»."]] },
  { id: "calm", ic: "🌊", name: "Тревога и состояние", line: "Что накрывает перед созвонами и как выдыхаешь.", meta: "11 разговоров",
    sub: "Что накрывает и что помогает",
    summary: "Тревога чаще всего телесная и перед «оценкой» — созвоны, дедлайны. Тебе помогает замедлиться, дыхание и то, что рядом кто-то есть.",
    insights: ["Тело реагирует раньше мыслей — сердце, дыхание.", "Помогает вдох на 4 и медленный выдох на 6, и что ты не одна."],
    moments: [["4 дня назад", "Паника перед созвоном — дышали вместе."], ["1 июля", "Разобрали, что за страхом «облажаться» стоит."]] },
  { id: "ideas", ic: "✨", name: "Идеи и мечты", line: "Хочешь своё дело про заботу о людях.", meta: "5 разговоров",
    sub: "Куда тебя тянет",
    summary: "Тебя тянет к своему делу, связанному с заботой о людях — но пугает нестабильность и «а вдруг не получится». Мечта живая, ты возвращаешься к ней снова.",
    insights: ["Загораешься, когда речь о помощи и уюте для других.", "Главный тормоз — не идея, а страх нестабильности."],
    saved: [{ type: "canvas", title: "Аудио-забота для уставших мам", date: "сегодня", body: [["Проблема", "Мамам негде взять короткую заботу о себе"], ["Для кого", "Работающая мама 30–40, «не успеваю для себя»"], ["Ценность", "5 минут заботы, что помещаются в день"], ["Деньги", "Подписка ~299 ₽/мес, неделя бесплатно"], ["Метрика", "Возврат на 2-ю неделю"], ["Преимущество", "Ты сама из этой аудитории"]] }],
    moments: [["неделю назад", "Фантазировали про маленькую студию заботы."], ["15 июня", "Первый раз призналась, что хочешь «своё»."]] },
  { id: "self", ic: "🕊", name: "Забота о себе", line: "Учишься возвращать себе время без вины.", meta: "8 разговоров",
    sub: "Возвращать себе время",
    summary: "Ты учишься не винить себя за отдых и возвращать себе кусочки времени. Маленькие ритуалы — чай, тишина, кот — работают лучше больших планов.",
    insights: ["Отдых пока даётся с чувством вины — но реже, чем раньше.", "Мелкие ритуалы восстанавливают тебя надёжнее «правильных» практик."],
    moments: [["2 дня назад", "Устроила себе вечер без телефона — и это было хорошо."], ["10 июня", "Договорились про 20 минут «только для себя» в день."]] },
];

function toggleTheme() {
  const el = document.documentElement;
  el.dataset.theme = el.dataset.theme === "day" ? "dusk" : "day";
}

function SavedCard({ s }: { s: Saved }) {
  return (
    <div className="saved-card">
      <div className="sv-head">
        <span className="sv-ic">{s.type === "canvas" ? "🚀" : "🪞"}</span>
        <div><b>{s.title}</b><span>сохранено {s.date} · из сессии</span></div>
      </div>
      {s.type === "canvas"
        ? s.body.map(([k, v]) => (<div className="kv" key={k}><div className="k">{k}</div><div className="v">{v}</div></div>))
        : s.body.map((p, i) => (<div className="pt" key={i}><span>{p}</span></div>))}
    </div>
  );
}

export default function MemoryScreen() {
  const [openId, setOpenId] = useState<string | null>(null);
  const t = THEMES.find((x) => x.id === openId) || null;

  if (t) {
    return (
      <div className="app">
        <div className="sbar">
          <button className="icobtn" onClick={() => setOpenId(null)} title="назад">‹</button>
          <h1>{t.name}</h1>
          <button className="icobtn right" onClick={toggleTheme}>◐</button>
        </div>
        <div className="sbody">
          <div className="d-head">
            <div className="d-ic">{t.ic}</div>
            <div><h2>{t.name}</h2><div className="d-sub">{t.sub}</div></div>
          </div>
          <div className="sec">Что я понимаю</div>
          <div className="d-summary">{t.summary}</div>
          {t.insights.map((i, idx) => (<div className="insight" key={idx}><span>{i}</span></div>))}
          {t.saved && (
            <>
              <div className="sec" style={{ marginTop: 24 }}>Сохранённые разборы</div>
              {t.saved.map((s, i) => (<SavedCard s={s} key={i} />))}
            </>
          )}
          <div className="sec" style={{ marginTop: 24 }}>Моменты</div>
          <div className="tl">
            {t.moments.map(([d, m], i) => (
              <div className="moment" key={i}><div className="m-date">{d}</div><div className="m-text">{m}</div></div>
            ))}
          </div>
          <a className="btn-primary" href="/chat" style={{ marginTop: 22 }}>Поговорить об этом</a>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="sbar">
        <button className="icobtn" onClick={() => (window.location.href = "/account")} title="назад">‹</button>
        <h1>То, что я о тебе знаю</h1>
        <button className="icobtn right" onClick={toggleTheme}>◐</button>
      </div>
      <div className="sbody">
        <div className="portrait">
          <Orb className="p-orb" />
          <div>
            <h2>Как я тебя вижу</h2>
            <p>Ты заботливая и ответственная, часто ставишь других выше себя. Последние месяцы много думаешь про баланс — как оставлять место и для себя. Тебя греют мелочи: вечерний чай, тишина, кот Персик.</p>
          </div>
        </div>
        <div className="sec">Твои темы <small>Ася сама раскладывает разговоры по темам — тебе не нужно ничего сортировать</small></div>
        <div className="themes">
          {THEMES.map((th) => (
            <button className={`theme ${th.big ? "big" : ""}`} key={th.id} onClick={() => setOpenId(th.id)}>
              <div className="t-ic">{th.ic}</div>
              <div className="t-body">
                <h3>{th.name}</h3>
                <div className="t-line">{th.line}</div>
                <div className="t-meta">{th.meta}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
