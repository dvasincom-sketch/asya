"use client";

import { useEffect, useState } from "react";
import { Orb } from "@/components/Orb";

export default function LoginPage() {
  const [stage, setStage] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Telegram Login Widget
  useEffect(() => {
    (window as unknown as { onTelegramAuth?: (u: unknown) => void }).onTelegramAuth = async (user) => {
      const r = await fetch("/api/auth/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user),
      });
      if (r.ok) window.location.href = "/account";
      else setError("Не получилось войти через Telegram. Попробуй ещё раз.");
    };

    const username = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
    const holder = document.getElementById("tg-login-btn");
    if (username && holder && holder.childElementCount === 0) {
      const s = document.createElement("script");
      s.async = true;
      s.src = "https://telegram.org/js/telegram-widget.js?22";
      s.setAttribute("data-telegram-login", username);
      s.setAttribute("data-size", "large");
      s.setAttribute("data-radius", "20");
      s.setAttribute("data-request-access", "write");
      s.setAttribute("data-onauth", "onTelegramAuth(user)");
      holder.appendChild(s);
    }
  }, []);

  async function requestCode() {
    if (!phone.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      if (r.ok) setStage("code");
      else setError("Не удалось отправить код. Проверь номер.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    if (!code.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      if (r.ok) window.location.href = "/account";
      else setError("Код неверный или истёк. Попробуй ещё раз.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app auth">
      <div className="auth-card">
        <Orb className="auth-orb" />
        <h2>Вход к Асе</h2>
        <p className="sub">Чтобы Ася помнила тебя и хранила ваши разговоры.</p>

        <div id="tg-login-btn" className="tg-wrap" />

        <div className="divider"><span>или по телефону</span></div>

        {stage === "phone" ? (
          <>
            <input
              className="auth-input"
              inputMode="tel"
              placeholder="+7 900 000-00-00"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") requestCode(); }}
            />
            <button className="btn-primary" onClick={requestCode} disabled={busy}>
              Получить код
            </button>
          </>
        ) : (
          <>
            <input
              className="auth-input"
              inputMode="numeric"
              placeholder="Код из SMS"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") verifyCode(); }}
            />
            <button className="btn-primary" onClick={verifyCode} disabled={busy}>
              Войти
            </button>
            <button className="btn-ghost" onClick={() => setStage("phone")}>
              Изменить номер
            </button>
          </>
        )}

        {error && <div className="auth-error">{error}</div>}

        <div className="auth-foot">Это общение и поддержка, не медицинская помощь 🌸</div>
      </div>
    </div>
  );
}
