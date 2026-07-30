"use client";

import { useEffect, useState } from "react";
import { Orb } from "./Orb";
import { track } from "@/lib/track";

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [agreed, setAgreed] = useState(false);
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState(false);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/consent")
      .then((r) => r.json())
      .then((d) => setAuthed(Boolean(d.user)))
      .catch(() => setAuthed(false));
  }, []);

  async function accept() {
    if (!agreed || !adult || busy) return;
    setBusy(true);
    setError("");
    try {
      // Вошедшему фиксируем согласие в базе; анонимному — просто пускаем в чат,
      // согласие запишется после входа.
      if (authed) {
        const r = await fetch("/api/consent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ terms: true, adult: true }),
        });
        if (!r.ok) throw new Error("consent");
      }
      track("consent_given");
      window.location.href = "/chat";
    } catch {
      setError("Не получилось сохранить согласие. Попробуй ещё раз.");
      setBusy(false);
    }
  }

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
                Понимаю, что Ася — это поддержка и общение, <b>не медицинская и не психологическая помощь</b>. Принимаю{" "}
                <a href="/terms" target="_blank">условия</a> и{" "}
                <a href="/privacy" target="_blank">политику конфиденциальности</a>, согласна на бережное хранение
                переписки.
              </span>
            </label>
            <label className="consent">
              <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
              <span>Мне есть 18 лет.</span>
            </label>

            <button className="btn-primary" disabled={!agreed || !adult || busy} onClick={accept}>
              {busy ? <span className="spinner" /> : "Начать разговор"}
            </button>
            {error && <div className="auth-error">{error}</div>}
            <div className="dots"><i /><i className="on" /></div>
          </>
        )}
      </div>
    </div>
  );
}
