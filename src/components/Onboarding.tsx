"use client";

import { useState } from "react";
import { Orb } from "./Orb";

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="app auth">
      <div className="auth-card">
        {step === 0 ? (
          <>
            <Orb className="auth-orb" />
            <h2>Привет, я Ася</h2>
            <p className="sub">
              Я не анкета и не тест. Просто подружка, с которой можно поговорить
              по-настоящему — и которая правда тебя узнаёт.
            </p>
            <button className="btn-primary" onClick={() => setStep(1)}>Дальше</button>
            <div className="dots"><i className="on" /><i /></div>
          </>
        ) : (
          <>
            <Orb className="auth-orb" />
            <h2>Как это будет</h2>
            <div className="points">
              <div className="point">
                <span className="pic">🌙</span>
                <div><b>Без спешки и осуждения</b><span>Говори что хочешь — я не тороплю и не оцениваю.</span></div>
              </div>
              <div className="point">
                <span className="pic">💬</span>
                <div><b>Иду вглубь бережно</b><span>Это не допрос, а тёплый разговор. Ты сама решаешь, насколько открыться.</span></div>
              </div>
              <div className="point">
                <span className="pic">🤍</span>
                <div><b>Я запоминаю тебя</b><span>И чем дольше мы говорим, тем лучше я тебя понимаю.</span></div>
              </div>
            </div>
            <label className="consent">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <span>
                Понимаю, что Ася — это поддержка и общение, <b>не медицинская и не психологическая помощь</b>,
                и согласна на бережное хранение переписки. <a href="#">Подробнее</a>
              </span>
            </label>
            <button className="btn-primary" disabled={!agreed} onClick={() => { window.location.href = "/chat"; }}>
              Начать разговор
            </button>
            <div className="dots"><i /><i className="on" /></div>
          </>
        )}
      </div>
    </div>
  );
}
