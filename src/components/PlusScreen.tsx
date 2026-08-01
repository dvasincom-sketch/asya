"use client";

import { useEffect, useState } from "react";
import { Orb } from "./Orb";

type PlusInfo = {
  plus: boolean;
  status: string | null;
  canceled: boolean;
  until: string | null;
  configured: boolean;
  price: string;
};

function dateRu(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

export default function PlusScreen() {
  const [info, setInfo] = useState<PlusInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  function load() {
    fetch("/api/plus")
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => {});
  }
  useEffect(() => {
    load();
  }, []);

  async function subscribe() {
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/plus/subscribe", { method: "POST" });
      const d = await r.json();
      if (d.url) {
        window.location.href = d.url;
        return;
      }
      if (d.already) {
        load();
        return;
      }
      setMsg(d.text || "Не получилось. Попробуй ещё раз.");
    } catch {
      setMsg("Не получилось. Попробуй ещё раз.");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    try {
      await fetch("/api/plus/cancel", { method: "POST" });
      load();
    } finally {
      setBusy(false);
    }
  }

  const price = `${info?.price || "300"} ₽`;

  return (
    <div className="app">
      <div className="sbar">
        <a className="icobtn" href="/account" title="назад">‹</a>
        <h1>Забота+</h1>
      </div>
      <div className="sbody">
        <div className="setup-intro">
          <Orb className="s-orb" />
          <h2>Чтобы я помнила тебя целиком</h2>
          <p>
            Разговаривать со мной всегда бесплатно. Забота+ — только за одно: чтобы твоя память и история хранились у
            меня полностью и без срока.
          </p>
        </div>

        <div className="scard">
          <div className="hrow"><span className="hic">🤍</span><div><b>Память навсегда</b><span>Я помню всё, что тебе важно, без ограничения по времени</span></div></div>
          <div className="hrow"><span className="hic">📜</span><div><b>Вся история разговоров</b><span>Не теряется и открывается целиком, а не только за последние дни</span></div></div>
          <div className="hrow"><span className="hic">🌿</span><div><b>Портрет и разборы без границ</b><span>Всё, что мы прошли вместе, остаётся с тобой</span></div></div>
        </div>

        {info && info.plus ? (
          <>
            <div className="account-who" style={{ display: "block", textAlign: "center", marginTop: 16 }}>
              {info.canceled
                ? `Активна до ${dateRu(info.until)} · продление отключено`
                : `Активна · следующее списание ${dateRu(info.until)}`}
            </div>
            {info.canceled ? (
              <button className="btn-primary" onClick={subscribe} disabled={busy}>
                {busy ? <span className="spinner" /> : "Возобновить"}
              </button>
            ) : (
              <button className="btn-ghost" onClick={cancel} disabled={busy}>Отменить подписку</button>
            )}
          </>
        ) : info && !info.configured ? (
          <div className="hnote" style={{ textAlign: "center" }}>
            Оплата скоро будет доступна — мы заканчиваем подключение. Совсем скоро Забота+ можно будет оформить прямо
            здесь 🤍
          </div>
        ) : (
          <>
            <button className="btn-primary" onClick={subscribe} disabled={busy}>
              {busy ? <span className="spinner" /> : `Оформить за ${price} / месяц`}
            </button>
            {msg && <div className="auth-error" style={{ textAlign: "center" }}>{msg}</div>}
          </>
        )}

        <div className="hnote">
          Оплата картой через YooKassa — данные карты мы не видим и не храним. Продление раз в месяц, отменить можно в
          любой момент: доступ сохранится до конца оплаченного периода. Подробности — в <a href="/terms">оферте</a>.
        </div>
      </div>
    </div>
  );
}
