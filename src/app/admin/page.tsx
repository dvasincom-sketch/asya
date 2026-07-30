"use client";

import { useEffect, useState } from "react";

type Stats = {
  period: { days: number; since: string };
  funnel: {
    landing: number; chatOpened: number; firstMessage: number; loggedIn: number;
    consentGiven: number; gateShown: number; miniappOpened: number;
  };
  conversion: { landingToChat: number; chatToFirstMessage: number; firstMessageToLogin: number; gateToLogin: number };
  retention: { peopleWithMessages: number; returnedAnotherDay: number; rate: number };
  sessions: { started: number; saved: number };
  totals: { users: number; messages: number; memories: number; crisisEvents: number; subscriptions: number };
};

export default function AdminPage() {
  const [key, setKey] = useState("");
  const [days, setDays] = useState(7);
  const [data, setData] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Ключ можно передать в адресе: /admin?key=... — тогда сводка откроется сразу.
  useEffect(() => {
    const k = new URLSearchParams(window.location.search).get("key");
    if (k) setKey(k);
  }, []);

  useEffect(() => {
    if (!key) return;
    setBusy(true);
    setError("");
    fetch(`/api/admin/stats?key=${encodeURIComponent(key)}&days=${days}`)
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setData(d)))
      .catch(() => setError("Не удалось загрузить сводку."))
      .finally(() => setBusy(false));
  }, [key, days]);

  return (
    <div className="app">
      <div className="sbar">
        <a className="icobtn" href="/" title="назад">‹</a>
        <h1>Сводка</h1>
      </div>
      <div className="sbody legal">
        {!key && (
          <>
            <p className="legal-lead">Введи админ-ключ, чтобы посмотреть воронку и удержание.</p>
            <input
              className="auth-input"
              placeholder="ADMIN_KEY"
              onKeyDown={(e) => { if (e.key === "Enter") setKey((e.target as HTMLInputElement).value.trim()); }}
            />
          </>
        )}

        {error && <div className="auth-error">{error}</div>}
        {busy && <div className="grp">Загружаю…</div>}

        {data && (
          <>
            <div className="stat-tabs">
              {[1, 7, 30].map((d) => (
                <button key={d} className={`opt-tab ${days === d ? "on" : ""}`} onClick={() => setDays(d)}>
                  {d === 1 ? "сутки" : `${d} дней`}
                </button>
              ))}
            </div>

            <div className="sec">Воронка</div>
            <div className="stat-grid">
              <div className="stat"><b>{data.funnel.landing}</b><span>увидели лендинг</span></div>
              <div className="stat"><b>{data.funnel.chatOpened}</b><span>открыли чат · {data.conversion.landingToChat}%</span></div>
              <div className="stat"><b>{data.funnel.firstMessage}</b><span>написали первое · {data.conversion.chatToFirstMessage}%</span></div>
              <div className="stat"><b>{data.funnel.loggedIn}</b><span>вошли · {data.conversion.firstMessageToLogin}%</span></div>
            </div>

            <div className="sec">Удержание</div>
            <div className="stat-grid">
              <div className="stat"><b>{data.retention.peopleWithMessages}</b><span>писали Асе</span></div>
              <div className="stat"><b>{data.retention.returnedAnotherDay}</b><span>вернулись в другой день</span></div>
              <div className="stat"><b>{data.retention.rate}%</b><span>возврат</span></div>
              <div className="stat"><b>{data.funnel.miniappOpened}</b><span>открыли в Telegram</span></div>
            </div>

            <div className="sec">Гейт и согласие</div>
            <div className="stat-grid">
              <div className="stat"><b>{data.funnel.gateShown}</b><span>дошли до лимита</span></div>
              <div className="stat"><b>{data.conversion.gateToLogin}%</b><span>из лимита во вход</span></div>
              <div className="stat"><b>{data.funnel.consentGiven}</b><span>приняли условия</span></div>
            </div>

            <div className="sec">Разборы</div>
            <div className="stat-grid">
              <div className="stat"><b>{data.sessions.started}</b><span>начали сессию</span></div>
              <div className="stat"><b>{data.sessions.saved}</b><span>сохранили итог</span></div>
            </div>

            <div className="sec">Всего в базе</div>
            <div className="stat-grid">
              <div className="stat"><b>{data.totals.users}</b><span>пользователей</span></div>
              <div className="stat"><b>{data.totals.messages}</b><span>сообщений</span></div>
              <div className="stat"><b>{data.totals.memories}</b><span>фактов в памяти</span></div>
              <div className="stat"><b>{data.totals.subscriptions}</b><span>подписок</span></div>
            </div>

            {data.totals.crisisEvents > 0 && (
              <>
                <div className="sec">Внимание</div>
                <div className="d-summary">
                  Кризисных срабатываний всего: {data.totals.crisisEvents}. Это разговоры, где включался протокол
                  безопасности — стоит время от времени проверять, что он ведёт себя бережно.
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
