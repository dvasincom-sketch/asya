"use client";

import { useEffect, useRef, useState } from "react";
import { Orb } from "@/components/Orb";
import { track } from "@/lib/track";

// Куда вести после входа: если согласие ещё не дано (или вышла новая редакция) — в онбординг.
async function afterLogin(): Promise<void> {
  track("login_done");
  try {
    const c = await fetch("/api/consent").then((r) => r.json());
    window.location.href = c?.needsConsent ? "/onboarding" : "/account";
  } catch {
    window.location.href = "/account";
  }
}

// Маска российского номера: показываем +7 900 000-00-00.
function formatRuPhone(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("8")) d = "7" + d.slice(1);
  if (d && !d.startsWith("7")) d = "7" + d;
  d = d.slice(0, 11);
  const p = d.slice(1);
  if (!p) return d ? "+7" : "";
  let out = "+7";
  if (p.length > 0) out += " " + p.slice(0, 3);
  if (p.length >= 4) out += " " + p.slice(3, 6);
  if (p.length >= 7) out += "-" + p.slice(6, 8);
  if (p.length >= 9) out += "-" + p.slice(8, 10);
  return out;
}

export default function LoginPage() {
  const [stage, setStage] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [tgBot, setTgBot] = useState<string | null>(process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || null);
  const [tgReady, setTgReady] = useState(false);
  const [tgTimedOut, setTgTimedOut] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    track("login_view", undefined, true);
    (window as unknown as { onTelegramAuth?: (u: unknown) => void }).onTelegramAuth = async (user) => {
      const r = await fetch("/api/auth/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user),
      });
      if (r.ok) await afterLogin();
      else setError("Не получилось войти через Telegram. Попробуй ещё раз.");
    };
    // Юзернейм бота берём в рантайме (getMe) — не зависим от build-time NEXT_PUBLIC.
    if (!tgBot) {
      fetch("/api/auth/tg-config")
        .then((r) => r.json())
        .then((d) => { if (typeof d.botUsername === "string" && d.botUsername) setTgBot(d.botUsername); })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Как только знаем юзернейм — рендерим кнопку Telegram Login Widget.
  // Виджет грузится со стороны telegram.org и появляется не мгновенно —
  // до появления настоящего iframe показываем лоадер (см. tgReady).
  useEffect(() => {
    if (!tgBot) return;
    const holder = document.getElementById("tg-login-btn");
    if (!holder) return;
    if (holder.querySelector("iframe")) { setTgReady(true); return; }
    if (holder.childElementCount === 0) {
      const s = document.createElement("script");
      s.async = true;
      s.src = "https://telegram.org/js/telegram-widget.js?22";
      s.setAttribute("data-telegram-login", tgBot);
      s.setAttribute("data-size", "large");
      s.setAttribute("data-radius", "20");
      s.setAttribute("data-request-access", "write");
      s.setAttribute("data-onauth", "onTelegramAuth(user)");
      holder.appendChild(s);
    }
    // Ждём, пока telegram.org подставит iframe с кнопкой.
    const obs = new MutationObserver(() => {
      if (holder.querySelector("iframe")) { setTgReady(true); obs.disconnect(); }
    });
    obs.observe(holder, { childList: true, subtree: true });
    // Страховка: не крутим лоадер бесконечно.
    const to = setTimeout(() => setTgTimedOut(true), 12000);
    return () => { obs.disconnect(); clearTimeout(to); };
  }, [tgBot]);

  // Обратный отсчёт для «отправить код заново».
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  async function requestCode(isResend = false) {
    if (phone.replace(/\D/g, "").length < 11) {
      setError("Введи номер полностью: +7 и 10 цифр.");
      return;
    }
    if (busy || (isResend && resendIn > 0)) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      if (r.ok) {
        setStage("code");
        setResendIn(45);
        setTimeout(() => codeRef.current?.focus(), 60);
      } else {
        const d = await r.json().catch(() => ({}));
        setError(d.text || "Не удалось отправить код. Попробуй позже.");
      }
    } catch {
      setError("Сеть недоступна. Попробуй ещё раз.");
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
      if (r.ok) await afterLogin();
      else {
        const d = await r.json().catch(() => ({}));
        setError(d.text || "Код неверный или истёк. Попробуй ещё раз.");
      }
    } catch {
      setError("Сеть недоступна. Попробуй ещё раз.");
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

        {tgBot || !tgTimedOut ? (
          <>
            <div className="tg-slot">
              {tgBot ? <div id="tg-login-btn" className="tg-wrap" /> : null}
              {!tgReady && !tgTimedOut ? (
                <div className="tg-loading" aria-label="загружаем вход через Telegram">
                  <span className="spinner tg-spinner" />
                </div>
              ) : null}
            </div>
            <div className="divider"><span>или по телефону</span></div>
          </>
        ) : null}

        {stage === "phone" ? (
          <>
            <input
              className="auth-input"
              inputMode="tel"
              placeholder="+7 900 000-00-00"
              value={phone}
              onChange={(e) => setPhone(formatRuPhone(e.target.value))}
              onKeyDown={(e) => { if (e.key === "Enter") requestCode(); }}
            />
            <button className="btn-primary" onClick={() => requestCode()} disabled={busy}>
              {busy ? <span className="spinner" /> : "Получить код"}
            </button>
          </>
        ) : (
          <>
            <p className="code-sent">Код отправлен на {phone}</p>
            <input
              ref={codeRef}
              className="auth-input"
              inputMode="numeric"
              placeholder="Код из SMS"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(e) => { if (e.key === "Enter") verifyCode(); }}
            />
            <button className="btn-primary" onClick={verifyCode} disabled={busy}>
              {busy ? <span className="spinner" /> : "Войти"}
            </button>
            <button className="btn-ghost" onClick={() => requestCode(true)} disabled={busy || resendIn > 0}>
              {resendIn > 0 ? `Отправить заново через ${resendIn}с` : "Отправить код заново"}
            </button>
            <button className="btn-ghost" onClick={() => { setStage("phone"); setError(""); setResendIn(0); }}>
              Изменить номер
            </button>
          </>
        )}

        {error && <div className="auth-error">{error}</div>}
        <a className="btn-ghost" href="/chat" style={{ marginTop: 14 }}>← Пока просто поговорить</a>
        <div className="auth-foot">Это общение и поддержка, не медицинская помощь 🌸</div>
      </div>
    </div>
  );
}
