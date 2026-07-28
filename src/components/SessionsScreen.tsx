"use client";

import { useState } from "react";
import { Orb } from "./Orb";

type Phase = { a: string; u: string };
type Template = {
  id: string; title: string; topic: string; labels: string[]; phases: Phase[];
  synthType: "points" | "canvas"; synthTitle: string; synthSub: string;
  synth: string[] | [string, string][]; saveTo: string;
};

const TEMPLATES: Record<string, Template> = {
  retro: {
    id: "retro", title: "Ретроспектива", topic: "Ретроспектива · работа за 3 месяца",
    labels: ["Настроиться", "Что было", "Чувства", "Паттерны", "Дальше", "Итог"],
    phases: [
      { a: "Давай спокойно оглянемся на эти три месяца работы. С чем ты приходишь — что хочется понять?", u: "Устала и не понимаю, почему опять на том же месте." },
      { a: "Вспомним, что это были за месяцы. Какие моменты всплывают первыми — и хорошие, и тяжёлые?", u: "Много созвонов, пара конфликтов… но и проект, которым горжусь." },
      { a: "А если убрать события и остаться с чувством — что ты чаще всего ощущала?", u: "Как будто бегу — и всё равно недостаточно." },
      { a: "Смотри: в июне думала уволиться, в июле впервые сказала «нет», сейчас снова «недостаточно». Как будто по кругу: берёшь на себя → выгораешь → винишь себя. Откликается?", u: "Да… именно так." },
      { a: "Что из этого хочешь взять с собой в следующий месяц — маленькое, но твоё?", u: "Разрешить себе останавливаться раньше, чем упаду." },
    ],
    synthType: "points", synthTitle: "Что мы увидели вместе", synthSub: "ретроспектива · работа",
    synth: ["За три месяца ты много вложила — и гордишься проектом, и вымоталась.", "Повторяется круг: берёшь на себя → выгораешь → винишь себя.", "Поворот уже начался — ты впервые сказала «нет».", "Твой шаг: останавливаться раньше, чем упадёшь."],
    saveTo: "Работа",
  },
  biz: {
    id: "biz", title: "Бизнес-идея", topic: "Собираем идею · «аудио-забота для уставших мам»",
    labels: ["Проблема", "Для кого", "Ценность", "Как работает", "Где найдут", "Деньги", "Что нужно", "Метрика", "Преимущество", "Итог"],
    phases: [
      { a: "Расскажи, с какой проблемы всё началось. Что у людей болит или неудобно?", u: "Уставшие мамы не могут выделить час на себя, а коротких форматов заботы почти нет." },
      { a: "Опиши того, кому это нужнее всех — конкретного человека.", u: "Мама двоих, 30–40, работает, вечно виноватая, что не успевает для себя." },
      { a: "Если в одной фразе — почему это выберут? Что тут особенного?", u: "5 минут заботы, которые реально помещаются в её день." },
      { a: "Как в общих чертах человек получает результат?", u: "Открыла приложение → короткое аудио под её состояние → стало легче." },
      { a: "Как эти люди о тебе узнают? Где они уже бывают?", u: "Мам-блоги, телеграм-каналы про материнство, сарафан." },
      { a: "На чём это зарабатывает? За что и как люди платят?", u: "Подписка ~299 ₽/мес, первая неделя бесплатно." },
      { a: "Что нужно, чтобы запустить и держать? Главные расходы?", u: "Записать аудио, простое приложение, немного на продвижение." },
      { a: "По какой одной цифре ты поймёшь, что идёт хорошо?", u: "Сколько мам возвращаются на вторую неделю." },
      { a: "И последнее: что у тебя есть, что трудно скопировать? Почему именно ты?", u: "Я сама такая мама и знаю этот контекст изнутри." },
    ],
    synthType: "canvas", synthTitle: "Карточка твоей идеи", synthSub: "собрано из твоих ответов",
    synth: [["Проблема", "Мамам негде взять короткую заботу о себе"], ["Для кого", "Работающая мама 30–40, «не успеваю для себя»"], ["Ценность", "5 минут заботы, что помещаются в день"], ["Деньги", "Подписка ~299 ₽/мес, неделя бесплатно"], ["Одна метрика", "Возврат на 2-ю неделю"], ["Твоё преимущество", "Ты сама из этой аудитории"]],
    saveTo: "Идеи",
  },
};

function toggleTheme() {
  const el = document.documentElement;
  el.dataset.theme = el.dataset.theme === "day" ? "dusk" : "day";
}

export default function SessionsScreen() {
  const [t, setT] = useState<Template | null>(null);
  const [step, setStep] = useState(1); // сколько фаз раскрыто
  const [synth, setSynth] = useState(false);
  const [savedDone, setSavedDone] = useState(false);

  function start(id: string) {
    setT(TEMPLATES[id]); setStep(1); setSynth(false); setSavedDone(false);
  }
  function reset() { setT(null); }
  function advance() {
    if (!t) return;
    if (step < t.phases.length) setStep(step + 1);
    else if (!synth) setSynth(true);
  }

  if (!t) {
    return (
      <div className="app">
        <div className="sbar">
          <button className="icobtn" onClick={() => (window.location.href = "/account")} title="назад">‹</button>
          <h1>Сессия с Асей</h1>
          <button className="icobtn right" onClick={toggleTheme}>◐</button>
        </div>
        <div className="sbody">
          <div className="setup-intro">
            <Orb className="s-orb" />
            <h2>Над чем поработаем?</h2>
            <p>Ася может просто выслушать — а может провести по шагам, как коуч. Методики внутри, а разговор живой.</p>
          </div>
          <div className="grp">Разобраться в себе</div>
          <button className="opt" onClick={() => start("retro")}><div className="o-ic">🪞</div><div><b>Ретроспектива</b><span>Оглянуться на период и увидеть, что происходило и что повторяется.</span></div></button>
          <button className="opt" onClick={() => start("retro")}><div className="o-ic">🌊</div><div><b>Разобраться в чувстве</b><span>Что это за состояние и откуда оно.</span></div></button>
          <div className="grp">Двигаться к цели</div>
          <button className="opt" onClick={() => start("biz")}><div className="o-ic">🚀</div><div><b>Проработать бизнес-идею</b><span>Собрать идею по полочкам через несколько простых вопросов.</span><span className="badge">9 вопросов · ~15 мин</span></div></button>
          <button className="opt" onClick={() => start("biz")}><div className="o-ic">⚖️</div><div><b>Принять решение</b><span>Взвесить варианты и понять, чего ты правда хочешь.</span></div></button>
        </div>
      </div>
    );
  }

  const currentIdx = synth ? t.labels.length - 1 : step - 1;
  const nextLabel = step < t.phases.length ? "Дальше →" : !synth ? "Подвести итог" : "Сессия завершена";

  return (
    <div className="app">
      <div className="sbar">
        <button className="icobtn" onClick={reset} title="назад">‹</button>
        <h1>{t.title}</h1>
        <button className="icobtn right" onClick={toggleTheme}>◐</button>
      </div>
      <div className="banner">
        <div className="sb-topic">{t.topic}</div>
        <div className="stepper">
          {t.labels.map((_, i) => (<i key={i} className={i < currentIdx ? "done" : i === currentIdx ? "now" : ""} />))}
        </div>
        <div className="sb-step"><b>{t.labels[currentIdx]}</b> · шаг {currentIdx + 1} из {t.labels.length}</div>
      </div>
      <div className="sbody">
        {t.phases.slice(0, step).map((p, i) => (
          <div key={i}>
            {i > 0 && <div className="phase-tag">{t.labels[i]}</div>}
            <div className="row assistant"><Orb className="mini-orb" /><div className="bubble">{p.a}</div></div>
            <div className="row user"><div className="bubble">{p.u}</div></div>
          </div>
        ))}
        {synth && (
          <>
            <div className="phase-tag">Итог</div>
            <div className="synth">
              <h3>{t.synthTitle}</h3>
              <div className="s-sub">{t.synthSub}</div>
              {t.synthType === "canvas"
                ? (t.synth as [string, string][]).map(([k, v]) => (<div className="kv" key={k}><div className="k">{k}</div><div className="v">{v}</div></div>))
                : (t.synth as string[]).map((p, i) => (<div className="pt" key={i}><span>{p}</span></div>))}
              <div className="save">
                <button className="primary" disabled={savedDone} onClick={() => setSavedDone(true)}>
                  {savedDone ? `Сохранено в «${t.saveTo}» 🤍` : `Сохранить в тему «${t.saveTo}»`}
                </button>
                <button className="ghost" onClick={reset}>Спасибо, Ася</button>
              </div>
            </div>
          </>
        )}
      </div>
      <div className="foot-btn">
        <button className="btn-primary" onClick={advance} disabled={synth}>{nextLabel}</button>
      </div>
    </div>
  );
}
