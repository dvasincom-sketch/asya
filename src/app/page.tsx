import { Orb } from "@/components/Orb";
import { LandingTracker } from "@/components/LandingTracker";

const STARTERS = [
  { label: "Мне тревожно", msg: "Мне тревожно" },
  { label: "Обсудить отношения", msg: "Хочу поговорить об отношениях" },
  { label: "Тяжело на работе", msg: "Тяжёлый день на работе" },
  { label: "Разобрать сон", msg: "Мне приснился странный сон" },
  { label: "Гороскоп", msg: "Что там по гороскопу на эту неделю?" },
  { label: "Просто поболтать", msg: "Просто хочется поговорить" },
];

export default function Home() {
  return (
    <main className="landing">
      {/* Первый экран — вход в чат */}
      <section className="hero">
        <div className="orb-stage">
          <span className="aura" />
          <span className="aura aura2" />
          <Orb className="hero-orb" />
        </div>
        <h1 className="wordmark">Ася</h1>
        <p className="tagline">Подружка, которая слушает по-настоящему — и правда узнаёт тебя.</p>
        <a className="cta" href="/chat">Поговорить с Асей</a>

        <div className="starters">
          <div className="starters-label">или начни с чего-то из этого</div>
          <div className="starters-row">
            {STARTERS.map((s) => (
              <a key={s.label} className="starter" href={`/chat?start=${encodeURIComponent(s.msg)}`}>
                {s.label}
              </a>
            ))}
          </div>
        </div>

        <div className="scroll-hint">что это ↓</div>
      </section>

      {/* Рассказ о проекте */}
      <section className="pitch">
        <p className="lead">
          Не поверхностный чат из дежурных вопросов. Ася бережно и без спешки помогает
          разобраться в себе — и чем дольше вы говорите, тем лучше она тебя понимает.
        </p>

        {/* Пример живого разговора */}
        <div className="sample">
          <div className="sample-label">вот как это бывает</div>
          <div className="row assistant"><Orb className="mini-orb" /><div className="bubble">Привет 🌙 Я тут. Как ты сегодня?</div></div>
          <div className="row user"><div className="bubble">Весь день на нервах, не могу выдохнуть</div></div>
          <div className="row assistant"><Orb className="mini-orb" /><div className="bubble">Слышу тебя. Такой день правда выматывает. Расскажешь, что было самым тяжёлым?</div></div>
          <div className="row user"><div className="bubble">Наверное, что я опять не успела ничего для себя</div></div>
          <div className="row assistant"><Orb className="mini-orb" /><div className="bubble">Похоже, дело не только в делах, а в том, что для тебя самой места не остаётся. Давно так?</div></div>
        </div>

        <div className="bento">
          <div className="btile big">
            <h3>Работает в России. Без VPN.</h3>
            <p>Ася — российская платформа. Никаких обходов и VPN — просто заходишь и говоришь, где бы ты ни была.</p>
          </div>
          <div className="btile">
            <h3>Бесплатно</h3>
            <p>Общаться можно бесплатно — и это та же сильная модель, что и в платной версии. Без урезаний.</p>
          </div>
          <div className="btile">
            <h3>Платишь за память</h3>
            <p>Деньги — только за хранение истории. Ася помнит тебя и ваши разговоры, и общение становится по-настоящему личным.</p>
          </div>
          <div className="btile wide warm">
            <div className="btile-orb"><Orb className="mini-orb" /></div>
            <h3>Тепло, а не сервис</h3>
            <p>Ася не оценивает и не торопит. Просто рядом — когда тревожно, одиноко или хочется, чтобы услышали.</p>
          </div>
        </div>

        <a className="cta" href="/chat">Начать разговор</a>

        <p className="disclaimer">
          Ася — это поддержка и общение, не медицинская и не психологическая помощь.
          Если тебе по-настоящему тяжело, рядом всегда есть люди, готовые помочь.
        </p>
        <div className="landing-foot">
          <a href="/privacy">Политика конфиденциальности</a> · <a href="/terms">Оферта</a>
        </div>
        <LandingTracker />
      </section>
    </main>
  );
}
