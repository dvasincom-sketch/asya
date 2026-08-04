"use client";

import { useEffect, useState } from "react";

type Stats = {
  funnel: { landing: number; chatOpened: number; firstMessage: number; loggedIn: number; consentGiven: number; gateShown: number; miniappOpened: number };
  conversion: { landingToChat: number; chatToFirstMessage: number; firstMessageToLogin: number; gateToLogin: number };
  retention: { peopleWithMessages: number; returnedAnotherDay: number; rate: number };
  sessions: { started: number; saved: number };
  totals: { users: number; messages: number; memories: number; crisisEvents: number; subscriptions: number };
  daily?: { day: string; messages: number; users: number }[];
};

type UserRow = {
  id: string; uid: string; label: string; authVia: string; joinedAt: string;
  firstMsg: string | null; lastMsg: string | null; daysSinceLast: number | null;
  msgs: number; activeDays: number; returned: boolean; skills: string[];
  sessions: number; sessionsSaved: number; memories: number;
  status: "active" | "at_risk" | "churned" | "dormant";
};
type UData = {
  generatedAt: string;
  insights: {
    total: number; authedTg: number; authedPhone: number; wrote: number;
    bounce1msg: number; oneDayOnly: number; returned2d: number;
    active: number; atRisk: number; churned: number; dormant: number;
    retentionRate: number; avgMsgs: number;
  };
  users: UserRow[];
};

type Convo = {
  profile: { label: string; authVia: string; joinedAt: string; messages: number; incognito: number };
  messages: { role: string; content: string; skill: string | null; at: string }[];
  truncated: boolean;
};

const SKILL_LABEL: Record<string, string> = {
  nutri: "Нутрициолог", astro: "Астролог", taro: "Таро", film: "Кино", tgguide: "Каналы",
};
const STATUS_LABEL: Record<UserRow["status"], string> = {
  active: "активен", at_risk: "под риском", churned: "ушёл", dormant: "молчит",
};

function ago(iso: string | null): string {
  if (!iso) return "—";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d <= 0) return "сегодня";
  if (d === 1) return "вчера";
  if (d < 7) return `${d} дн назад`;
  if (d < 30) return `${Math.floor(d / 7)} нед назад`;
  return `${Math.floor(d / 30)} мес назад`;
}
function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export default function AdminPage() {
  const [key, setKey] = useState("");
  const [days, setDays] = useState(7);
  const [stats, setStats] = useState<Stats | null>(null);
  const [ud, setUd] = useState<UData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"all" | "churned" | "at_risk" | "active">("all");
  const [openU, setOpenU] = useState<UserRow | null>(null);
  const [convo, setConvo] = useState<Convo | null>(null);
  const [convoBusy, setConvoBusy] = useState(false);
  const [hoverDay, setHoverDay] = useState<number | null>(null);

  function openUser(u: UserRow) {
    setOpenU(u);
    setConvo(null);
    setConvoBusy(true);
    fetch(`/api/admin/user/${encodeURIComponent(u.uid)}?key=${encodeURIComponent(key)}`)
      .then((r) => r.json())
      .then((d) => (d.error ? setConvo(null) : setConvo(d)))
      .catch(() => setConvo(null))
      .finally(() => setConvoBusy(false));
  }
  function closeUser() {
    setOpenU(null);
    setConvo(null);
  }

  useEffect(() => {
    const k = new URLSearchParams(window.location.search).get("key");
    if (k) setKey(k);
  }, []);

  // Воронка/обзор — за период. Пользователи/отток — за всё время.
  useEffect(() => {
    if (!key) return;
    setBusy(true);
    setError("");
    fetch(`/api/admin/stats?key=${encodeURIComponent(key)}&days=${days}`)
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setStats(d)))
      .catch(() => setError("Не удалось загрузить сводку."))
      .finally(() => setBusy(false));
  }, [key, days]);

  useEffect(() => {
    if (!key) return;
    fetch(`/api/admin/users?key=${encodeURIComponent(key)}`)
      .then((r) => r.json())
      .then((d) => (d.error ? null : setUd(d)))
      .catch(() => {});
  }, [key]);

  if (!key) {
    return (
      <div className="dash dash-auth">
        <div className="dash-authcard">
          <h1>Панель · Ася</h1>
          <p>Введи админ-ключ, чтобы открыть аналитику.</p>
          <input
            className="auth-input"
            placeholder="ADMIN_KEY"
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") setKey((e.target as HTMLInputElement).value.trim()); }}
          />
        </div>
      </div>
    );
  }

  const f = stats?.funnel;
  const fmax = f ? Math.max(f.landing, f.chatOpened, f.firstMessage, f.loggedIn, 1) : 1;
  const funnelRows = f
    ? [
        { label: "Увидели лендинг", val: f.landing, pct: null as number | null },
        { label: "Открыли чат", val: f.chatOpened, pct: stats!.conversion.landingToChat },
        { label: "Написали первое", val: f.firstMessage, pct: stats!.conversion.chatToFirstMessage },
        { label: "Вошли", val: f.loggedIn, pct: stats!.conversion.firstMessageToLogin },
      ]
    : [];

  const ins = ud?.insights;
  const users = ud?.users ?? [];
  const shown = users.filter((u) => (tab === "all" ? true : u.status === tab));

  return (
    <div className="dash">
      <div className="dash-top">
        <div>
          <h1>Панель · Ася</h1>
          {ud && <div className="dash-sub">Обновлено {new Date(ud.generatedAt).toLocaleString("ru-RU")}</div>}
        </div>
        <div className="seg">
          {[1, 7, 30].map((d) => (
            <button key={d} className={`seg-btn ${days === d ? "on" : ""}`} onClick={() => setDays(d)}>
              {d === 1 ? "сутки" : `${d} дней`}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="dash-error">{error}</div>}
      {busy && !stats && <div className="dash-muted">Загружаю…</div>}

      {/* Обзор */}
      {(stats || ins) && (
        <>
          <div className="dash-sec">Обзор · всего в базе</div>
          <div className="kpi-grid">
            <div className="kpi"><b>{stats?.totals.users ?? "—"}</b><span>пользователей</span></div>
            <div className="kpi"><b>{ins?.wrote ?? "—"}</b><span>писали Асе</span></div>
            <div className="kpi"><b>{stats?.totals.messages ?? "—"}</b><span>сообщений</span></div>
            <div className="kpi"><b>{ins ? `${ins.retentionRate}%` : "—"}</b><span>вернулись 2+ дня</span></div>
            <div className="kpi"><b>{ins?.avgMsgs ?? "—"}</b><span>сообщений на человека</span></div>
            <div className="kpi"><b>{stats?.totals.subscriptions ?? "—"}</b><span>подписок</span></div>
          </div>
        </>
      )}

      {/* Воронка */}
      {f && (
        <>
          <div className="dash-sec">Воронка · за {days === 1 ? "сутки" : `${days} дней`}</div>
          <div className="fbars">
            {funnelRows.map((r) => (
              <div className="fbar" key={r.label}>
                <div className="fbar-head">
                  <span className="fbar-label">{r.label}</span>
                  <span className="fbar-val">{r.val}{r.pct !== null && <em> · {r.pct}%</em>}</span>
                </div>
                <div className="fbar-track"><div className="fbar-fill" style={{ width: `${Math.round((r.val / fmax) * 100)}%` }} /></div>
              </div>
            ))}
          </div>
          <div className="dash-note">Открыли в Telegram: {f.miniappOpened} · приняли условия: {f.consentGiven} · дошли до лимита: {f.gateShown}</div>
        </>
      )}

      {/* Активность по дням */}
      {stats?.daily && stats.daily.length > 1 && (() => {
        const dd = stats.daily;
        const maxM = Math.max(1, ...dd.map((x) => x.messages));
        const totalM = dd.reduce((a, x) => a + x.messages, 0);
        const hv = hoverDay != null ? dd[hoverDay] : null;
        const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
        return (
          <>
            <div className="dash-sec">Активность по дням</div>
            <div className="chart">
              <div className="chart-cap">
                {hv
                  ? <><b>{hv.messages}</b> сообщений · {hv.users} чел · {fmtDay(hv.day)}</>
                  : <><b>{totalM}</b> сообщений за период</>}
              </div>
              <div className="chart-bars" onMouseLeave={() => setHoverDay(null)}>
                {dd.map((x, i) => (
                  <div className="cbar-col" key={x.day} onMouseEnter={() => setHoverDay(i)}>
                    <div className={`cbar ${hoverDay === i ? "on" : ""}`} style={{ height: `${Math.round((x.messages / maxM) * 100)}%` }} />
                  </div>
                ))}
              </div>
              <div className="chart-x"><span>{fmtDay(dd[0].day)}</span><span>{fmtDay(dd[dd.length - 1].day)}</span></div>
            </div>
          </>
        );
      })()}

      {/* Удержание и отток */}
      {ins && (
        <>
          <div className="dash-sec">Удержание и отток · всё время</div>
          <div className="ins-grid">
            <div className="ins good"><b>{ins.active}</b><span>активны (≤2 дн)</span></div>
            <div className="ins warn"><b>{ins.atRisk}</b><span>под риском (3–7 дн)</span></div>
            <div className="ins bad"><b>{ins.churned}</b><span>ушли (&gt;7 дн)</span></div>
            <div className="ins"><b>{ins.dormant}</b><span>ни разу не писали</span></div>
            <div className="ins"><b>{ins.bounce1msg}</b><span>написали один раз</span></div>
            <div className="ins"><b>{ins.oneDayOnly}</b><span>приходили один день</span></div>
          </div>
          <div className="dash-note">
            Из {ins.wrote} написавших вернулись в другой день {ins.returned2d} ({ins.retentionRate}%). Вход: Telegram {ins.authedTg} · телефон {ins.authedPhone}.
          </div>
        </>
      )}

      {/* Пользователи */}
      {users.length > 0 && (
        <>
          <div className="dash-sec">Пользователи</div>
          <div className="seg seg-sm">
            {([["all", "все"], ["active", "активные"], ["at_risk", "под риском"], ["churned", "ушли"]] as const).map(([k, l]) => (
              <button key={k} className={`seg-btn ${tab === k ? "on" : ""}`} onClick={() => setTab(k)}>{l}</button>
            ))}
          </div>
          <div className="utable-wrap">
            <table className="utable">
              <thead>
                <tr>
                  <th>Кто</th><th>Вход</th><th>Пришёл</th><th>Последняя активность</th>
                  <th className="num">Сообщений</th><th className="num">Дней</th><th>Навыки</th><th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((u) => (
                  <tr key={u.id} className="urow" onClick={() => openUser(u)}>
                    <td className="mono">{u.label}</td>
                    <td>{u.authVia === "tg" ? "Telegram" : u.authVia === "phone" ? "телефон" : "—"}</td>
                    <td>{shortDate(u.joinedAt)}</td>
                    <td>{ago(u.lastMsg)}</td>
                    <td className="num">{u.msgs}</td>
                    <td className="num">{u.activeDays}{u.returned && <span className="ret-dot" title="возвращался">•</span>}</td>
                    <td>{u.skills.length ? u.skills.map((s) => <span key={s} className="uskill">{SKILL_LABEL[s] || s}</span>) : <span className="dash-dim">—</span>}</td>
                    <td><span className={`ubadge ${u.status}`}>{STATUS_LABEL[u.status]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {stats && stats.totals.crisisEvents > 0 && (
        <div className="dash-crisis">Кризисных срабатываний: {stats.totals.crisisEvents}. Проверь, что протокол безопасности ведёт себя бережно.</div>
      )}

      {/* Переписка пользователя */}
      <div className={`cv-ov ${openU ? "on" : ""}`} onClick={closeUser} />
      <aside className={`cv-drawer ${openU ? "on" : ""}`}>
        {openU && (
          <>
            <div className="cv-head">
              <div>
                <b>{openU.label}</b>
                <span>
                  {openU.authVia === "tg" ? "Telegram" : openU.authVia === "phone" ? "телефон" : "—"} · пришёл {shortDate(openU.joinedAt)} · {openU.msgs} сообщений · {openU.activeDays} дн
                </span>
              </div>
              <button className="cv-close" onClick={closeUser} aria-label="закрыть">✕</button>
            </div>
            <div className="cv-body">
              {convoBusy && <div className="dash-muted">Загружаю переписку…</div>}
              {!convoBusy && convo && convo.messages.length === 0 && (
                <div className="dash-muted">Сохранённой переписки нет{convo.profile.incognito > 0 ? ` (в инкогнито ${convo.profile.incognito} — зашифровано, не читается)` : ""}.</div>
              )}
              {!convoBusy && convo && convo.messages.map((m, i) => (
                <div key={i} className={`cv-row ${m.role === "user" ? "me" : "as"}`}>
                  <div className="cv-bubble">
                    {m.skill && <span className="cv-skill">{SKILL_LABEL[m.skill] || m.skill}</span>}
                    {m.content}
                    <span className="cv-time">{new Date(m.at).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                </div>
              ))}
              {convo && convo.truncated && <div className="dash-muted">Показаны последние 500 сообщений.</div>}
              {convo && convo.profile.incognito > 0 && convo.messages.length > 0 && (
                <div className="cv-note">🕶️ Ещё {convo.profile.incognito} сообщений в инкогнито — зашифрованы ключом устройства, не читаются.</div>
              )}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
