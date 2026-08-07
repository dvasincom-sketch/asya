"use client";

import { useEffect, useState, type ReactNode } from "react";

type Caps = Record<string, boolean>;
type CapDef = { key: string; title: string; hint: string; group: string; soon?: boolean };
type CustomCmd = { cmd: string; reply: string };
type Chat = { chatId: string; title: string | null; role: string; space: string; rules: string | null; repoUrl: string | null; enabled: boolean; commands?: string | null; caps?: string | null; resolvedCaps?: Caps; msgCount?: number; lastAt?: string | null; articleCount?: number };
type Article = { id: string; space: string; title: string; body: string; source?: string | null };
type Overview = { chatsConnected: number; chatsTotal: number; messagesStored: number; messagesFromAsya: number; articles: number; spaces: number; sections?: { space: string; count: number }[] };
type HistMsg = { userName: string | null; text: string; fromBot: boolean; createdAt: string };
type SectionCount = { space: string; count: number };
type Fetcher = (path: string, init?: RequestInit) => Promise<any>;

const KEY_STORE = "asya_admin_key";
const BUILTIN_TITLES: Record<string, string> = { off: "Выключено", support: "Поддержка", moderation: "Модерация", both: "Модерация и поддержка" };

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); } catch { return "—"; }
}
function parseCmds(json?: string | null): CustomCmd[] {
  try { const p = JSON.parse(json || "[]"); return Array.isArray(p) ? p.map((x) => ({ cmd: String(x.cmd || ""), reply: String(x.reply || "") })) : []; } catch { return []; }
}

function GithubIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" style={{ opacity: 0.85 }}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function IconDoc() {
  return (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></svg>);
}
function IconGear() {
  return (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H2a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 8a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V2a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H22a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>);
}
function IconChat() {
  return (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>);
}
function IconGauge() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 1 0-9-9" /><path d="M12 12l4-3" /></svg>);
}
function IconDb() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5" /><path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" /></svg>);
}
function IconGrid() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>);
}
function IconBell() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>);
}
function IconSpark() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2" /></svg>);
}
function IconMenu() {
  return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18" /></svg>);
}
function IconChart() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3v18h18" /><rect x="7" y="11" width="3" height="6" rx="1" /><rect x="12.5" y="7" width="3" height="10" rx="1" /><rect x="18" y="13" width="3" height="4" rx="1" /></svg>);
}

function Dropdown({ value, options, onChange, width }: { value: string; options: { v: string; t: string }[]; onChange: (v: string) => void; width?: number }) {
  const [open, setOpen] = useState(false);
  const cur = options.find((o) => o.v === value);
  return (
    <div style={{ position: "relative", width: width || 220 }}>
      <button type="button" onClick={() => setOpen((o) => !o)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, background: "var(--glass)", border: "1px solid var(--line)", borderRadius: 12, padding: "10px 13px", color: "var(--text)", fontSize: 14, cursor: "pointer", textAlign: "left" }}>
        <span>{cur?.t || value || "—"}</span><span style={{ opacity: 0.5, transform: open ? "rotate(180deg)" : "none", transition: "0.2s" }}>▾</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 30, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: 6, boxShadow: "0 20px 50px -12px rgba(0,0,0,.6)", maxHeight: 280, overflowY: "auto" }}>
          {options.map((o) => (
            <div key={o.v} onMouseDown={() => { onChange(o.v); setOpen(false); }}
              style={{ padding: "9px 11px", borderRadius: 9, fontSize: 14, cursor: "pointer", color: o.v === value ? "var(--accent)" : "var(--text)", background: o.v === value ? "var(--glass)" : "transparent" }}>{o.t}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (b: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!on)}
      style={{ width: 42, height: 24, borderRadius: 12, border: "none", cursor: "pointer", background: on ? "linear-gradient(135deg,var(--bubble-u1),var(--bubble-u2))" : "var(--line)", position: "relative", transition: "0.2s", flex: "0 0 auto" }}>
      <span style={{ position: "absolute", top: 3, left: 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "0.2s", transform: on ? "translateX(18px)" : "none" }} />
    </button>
  );
}

export default function AdminDashboard() {
  const [key, setKey] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<"dash" | "stats" | "chats" | "kb" | "data">("dash");
  const [err, setErr] = useState("");
  const [kbInit, setKbInit] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">("light");
  const [sideOpen, setSideOpen] = useState(false);

  const [overview, setOverview] = useState<Overview | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [spaces, setSpaces] = useState<string[]>([]);
  const [seedErr, setSeedErr] = useState("");
  const [capDefs, setCapDefs] = useState<CapDef[]>([]);
  const [groups, setGroups] = useState<string[]>([]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    let k = q.get("key") || "";
    if (!k) { try { k = window.localStorage.getItem(KEY_STORE) || ""; } catch { k = ""; } }
    try { const t = window.localStorage.getItem("asya_admin_theme"); if (t === "light" || t === "dark") setTheme(t); } catch { /* ignore */ }
    if (k) { setKey(k); void loadAll(k); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function makeFetcher(k: string): Fetcher {
    return (path, init) => {
      const sep = path.includes("?") ? "&" : "?";
      return fetch(`${path}${sep}key=${encodeURIComponent(k)}`, init).then((x) => x.json()).catch(() => null);
    };
  }
  const af = makeFetcher(key);

  async function loadAll(k = key) {
    const f = makeFetcher(k);
    const ov = await f("/api/admin/overview");
    if (!ov || ov.error) { setErr("Доступ закрыт — проверь ключ."); return; }
    setErr("");
    try { window.localStorage.setItem(KEY_STORE, k); } catch { /* ignore */ }
    setOverview(ov);
    const [ch, rl] = await Promise.all([f("/api/admin/chats"), f("/api/admin/roles")]);
    if (ch && !ch.error) { setChats(ch.chats || []); setSpaces(ch.spaces || []); setSeedErr(ch.seedError || ""); }
    if (rl && !rl.error) { setCapDefs(rl.caps || []); setGroups(rl.groups || []); }
    setLoaded(true);
  }
  function logout() {
    try { window.localStorage.removeItem(KEY_STORE); } catch { /* ignore */ }
    setKey(""); setLoaded(false); setOverview(null); setChats([]);
  }
  function toggleTheme() {
    setTheme((t) => { const n = t === "light" ? "dark" : "light"; try { window.localStorage.setItem("asya_admin_theme", n); } catch { /* ignore */ } return n; });
  }
  const NAV: Array<{ group?: string; k?: "dash" | "stats" | "chats" | "kb" | "data"; label?: string; icon?: ReactNode; soon?: boolean }> = [
    { group: "Обзор" },
    { k: "dash", label: "Дашборд", icon: <IconGauge /> },
    { k: "stats", label: "Аналитика", icon: <IconChart /> },
    { k: "data", label: "Данные", icon: <IconDb /> },
    { group: "Управление" },
    { k: "chats", label: "Проекты", icon: <IconGrid /> },
    { k: "kb", label: "База знаний", icon: <IconDoc /> },
    { group: "Ася" },
    { label: "Личность", icon: <IconSpark />, soon: true },
    { label: "Уведомления", icon: <IconBell />, soon: true },
  ];

  const titles: Record<string, string> = { dash: "С возвращением", stats: "Аналитика", chats: "Проекты", kb: "База знаний", data: "Данные" };
  const subtitles: Record<string, string> = {
    dash: "Обзор проектов Аси, поддержки и базы знаний.",
    stats: "Воронка, удержание и пользователи приложения.",
    chats: "Чаты, где работает Ася, и их настройки.",
    kb: "Статьи, по которым Ася отвечает участникам.",
    data: "Что реально хранится в базе на твоём сервере.",
  };

  if (!loaded) {
    return (
      <div className="admin-wrap" data-theme={theme === "dark" ? "dark" : undefined}>
        <div className="admin-shell">
          <main className="admin-main">
            <div className="admin-panel">
              <h1 className="admin-h1">Ася — панель управления</h1>
              <p className="admin-sub">Комьюнити-менеджер, поддержка и база знаний в одном месте.</p>
              <div className="admin-row">
                <input placeholder="ADMIN_KEY" value={key} onChange={(e) => setKey(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") loadAll(); }} className="admin-inp" style={{ width: 260 }} />
                <button onClick={() => loadAll()} className="admin-btn">Войти</button>
                <button onClick={toggleTheme} className="admin-btn ghost">{theme === "light" ? "Тёмная тема" : "Светлая тема"}</button>
                {err && <span style={{ color: "var(--bubble-u1)", alignSelf: "center" }}>{err}</span>}
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-wrap" data-theme={theme === "dark" ? "dark" : undefined}>
      <div className="admin-shell">
        {sideOpen && <div className="admin-scrim" onClick={() => setSideOpen(false)} />}
        <aside className={`admin-side${sideOpen ? " open" : ""}`}>
          <div className="admin-brand"><span className="admin-logo">А</span> Ася</div>
          <nav className="admin-nav">
            {NAV.map((it, i) => it.group
              ? <div key={`g${i}`} className="admin-navgroup">{it.group}</div>
              : (
                <button key={it.k || `s${i}`} className={`admin-navitem${it.soon ? " soon" : ""}${!it.soon && tab === it.k ? " active" : ""}`} onClick={() => { if (!it.soon && it.k) { setTab(it.k); setSideOpen(false); } }} disabled={it.soon}>
                  {it.icon}<span>{it.label}</span>{it.soon && <span className="admin-soon" style={{ marginLeft: "auto" }}>скоро</span>}
                </button>
              ))}
          </nav>
          <div className="admin-side-foot">
            <button className="admin-navitem" onClick={toggleTheme}>{theme === "light" ? "Тёмная тема" : "Светлая тема"}</button>
            <button className="admin-navitem" onClick={logout}>Сменить ключ</button>
          </div>
        </aside>

        <main className="admin-main">
          <div className="admin-topbar">
            <div className="admin-topbar-l">
              <button className="admin-burger" onClick={() => setSideOpen(true)} aria-label="Меню"><IconMenu /></button>
              <div>
                <h1 className="admin-h1" style={{ margin: 0 }}>{titles[tab]}</h1>
                <div className="admin-topsub">{subtitles[tab]}</div>
              </div>
            </div>
            <div className="admin-topbar-r">
              <div className="admin-status"><span className="admin-statusdot" /> Ася активна</div>
              <div className="admin-avatar" aria-hidden="true" />
            </div>
          </div>
          <div className="admin-content">
            {seedErr && <div className="admin-err">База данных сейчас недоступна — часть данных может не отображаться, а изменения не сохранятся, пока база не поднимется. Детали: {seedErr}</div>}
            {tab === "dash" && <DashTab overview={overview} chats={chats} onRefresh={() => loadAll()} />}
            {tab === "stats" && <AnalyticsTab af={af} />}
            {tab === "chats" && <ChatsTab chats={chats} setChats={setChats} spaces={spaces} capDefs={capDefs} groups={groups} af={af} reload={() => loadAll()} onGoKb={(sp) => { setKbInit(sp); setTab("kb"); }} />}
            {tab === "kb" && <KbTab af={af} initSpace={kbInit} />}
            {tab === "data" && <DataTab af={af} />}
          </div>
        </main>
      </div>
    </div>
  );
}

const DONUT_PAL = ["var(--accent)", "var(--bubble-u2)", "var(--bubble-u1)", "var(--text-dim)", "var(--text-soft)"];

function DashTab({ overview, chats, onRefresh }: { overview: Overview | null; chats: Chat[]; onRefresh: () => void }) {
  const [seg, setSeg] = useState<"all" | "on" | "off">("all");
  if (!overview) return <div className="admin-hint">Нет данных.</div>;

  const tiles = [
    { num: overview.chatsConnected, lbl: "Активных проектов", icon: <IconGrid />, note: `из ${overview.chatsTotal} подключённых` },
    { num: overview.messagesStored, lbl: "Сообщений в истории", icon: <IconChat />, note: "копится с подключения" },
    { num: overview.messagesFromAsya, lbl: "Ответов Аси", icon: <IconSpark />, note: "поддержка · команды · кризис" },
    { num: overview.articles, lbl: "Статей в базе", icon: <IconDoc />, note: `в ${overview.spaces} разделах` },
  ];

  const filtered = chats.filter((c) => (seg === "all" ? true : seg === "on" ? c.enabled : !c.enabled));
  const roleMap = new Map<string, number>();
  for (const c of filtered) { const n = BUILTIN_TITLES[c.role] || c.role || "Без роли"; roleMap.set(n, (roleMap.get(n) || 0) + 1); }
  const roles = Array.from(roleMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxRole = Math.max(1, ...roles.map((r) => r[1]));
  const activeN = chats.filter((c) => c.enabled).length;
  const withKb = chats.filter((c) => (c.articleCount || 0) > 0).length;

  const secs = [...(overview.sections || [])].sort((a, b) => b.count - a.count);
  const total = secs.reduce((s, x) => s + x.count, 0);
  const maxSec = Math.max(1, ...secs.map((x) => x.count));

  return (
    <div className="admin-subcontent">
      <div className="admin-tiles">
        {tiles.map((t) => (
          <div key={t.lbl} className="admin-tile">
            <div className="admin-tile-top"><span className="admin-tile-ic">{t.icon}</span><span className="lbl">{t.lbl}</span></div>
            <div className="num">{t.num}</div>
            <div className="admin-tile-foot">{t.note}</div>
          </div>
        ))}
      </div>

      <div className="admin-grid2">
        <div className="admin-card2">
          <div className="admin-card2-h">
            <h3>Обзор проектов</h3>
            <div className="admin-seg">
              {([["all", "Все"], ["on", "Активные"], ["off", "Выключены"]] as const).map(([v, l]) => (
                <button key={v} className={seg === v ? "on" : ""} onClick={() => setSeg(v)}>{l}</button>
              ))}
            </div>
          </div>
          <div className="admin-card2-b">
            <div className="admin-lbl">По ролям</div>
            <div className="admin-roles">
              {roles.length === 0 && <div className="admin-hint" style={{ margin: 0 }}>Нет проектов в выборке.</div>}
              {roles.map(([name, n], i) => (
                <div key={name} className="admin-rolerow">
                  <span className="admin-role-name"><span className="admin-role-dot" style={{ background: DONUT_PAL[i % DONUT_PAL.length] }} />{name}</span>
                  <span className="admin-role-track"><span className="admin-role-fill" style={{ width: `${(n / maxRole) * 100}%`, background: DONUT_PAL[i % DONUT_PAL.length] }} /></span>
                  <b>{n}</b>
                </div>
              ))}
            </div>
            <div className="admin-lbl">Состояние</div>
            <div className="admin-states">
              <div className="admin-state"><b>{activeN}</b> активны</div>
              <div className="admin-state"><b>{chats.length - activeN}</b> выключены</div>
              <div className="admin-state"><b>{withKb}</b> с базой знаний</div>
            </div>
          </div>
        </div>

        <div className="admin-card2">
          <div className="admin-card2-h"><h3>База знаний</h3></div>
          <div className="admin-card2-b">
            <div className="admin-kbsum"><b>{total}</b> {total === 1 ? "статья" : "статей"} · {secs.length} {secs.length === 1 ? "раздел" : "разделов"}</div>
            <div className="admin-roles" style={{ marginTop: 16, marginBottom: 0 }}>
              {secs.length === 0 && <div className="admin-hint" style={{ margin: 0 }}>Пока нет статей.</div>}
              {secs.map((x, i) => (
                <div key={x.space} className="admin-rolerow">
                  <span className="admin-role-name"><span className="admin-role-dot" style={{ background: DONUT_PAL[i % DONUT_PAL.length] }} />{x.space}</span>
                  <span className="admin-role-track"><span className="admin-role-fill" style={{ width: `${(x.count / maxSec) * 100}%`, background: DONUT_PAL[i % DONUT_PAL.length] }} /></span>
                  <b>{x.count}</b>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14 }}><button onClick={onRefresh} className="admin-btn ghost">Обновить</button></div>
      <p className="admin-hint">История сообщений копится с момента подключения проекта (Telegram не отдаёт переписку задним числом). «Ответов Аси» — сколько раз она ответила по существу (поддержка, команды, кризис).</p>
    </div>
  );
}

type Stats = { funnel: Record<string, number>; retention: { peopleWithMessages: number; returnedAnotherDay: number; rate: number }; totals: { users: number; messages: number; memories: number; crisisEvents: number; subscriptions: number } };
type UserRow = { uid: string; label: string; msgs: number; activeDays: number; status: string; joinedAt?: string };
type UData = { insights: { total: number; active: number; atRisk: number; churned: number; dormant: number; retentionRate: number; avgMsgs: number }; users: UserRow[] };

const STATUS: Record<string, { t: string; c: string }> = {
  active: { t: "Активен", c: "var(--ok, #16a34a)" },
  at_risk: { t: "Под риском", c: "#e8863a" },
  churned: { t: "Ушёл", c: "var(--bubble-u1)" },
  dormant: { t: "Молчит", c: "var(--text-dim)" },
};

function AnalyticsTab({ af }: { af: Fetcher }) {
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState<Stats | null>(null);
  const [ud, setUd] = useState<UData | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let alive = true;
    Promise.all([af(`/api/admin/stats?days=${days}`), af("/api/admin/users")]).then(([s, u]) => {
      if (!alive) return;
      if (!s || s.error) { setErr(true); return; }
      setStats(s); if (u && !u.error) setUd(u);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  if (err) return <div className="admin-hint">Аналитика недоступна — проверь ключ или базу данных.</div>;
  if (!stats) return <div className="admin-hint">Загрузка…</div>;

  const tiles = [
    { num: stats.totals.users, lbl: "Пользователей", icon: <IconGrid /> },
    { num: stats.totals.messages, lbl: "Сообщений", icon: <IconChat /> },
    { num: stats.totals.memories, lbl: "Записей памяти", icon: <IconSpark /> },
    { num: stats.totals.subscriptions, lbl: "Подписок", icon: <IconDoc /> },
  ];
  const steps: { k: string; l: string }[] = [
    { k: "landing", l: "Лендинг" }, { k: "chatOpened", l: "Открыли чат" }, { k: "firstMessage", l: "Первое сообщение" }, { k: "loggedIn", l: "Вошли" }, { k: "consentGiven", l: "Согласие" },
  ];
  const fmax = Math.max(1, ...steps.map((s) => stats.funnel[s.k] || 0));
  const users = ud ? [...ud.users].sort((a, b) => b.msgs - a.msgs).slice(0, 60) : [];

  return (
    <div className="admin-subcontent">
      <div className="admin-row" style={{ justifyContent: "flex-end", marginBottom: 4 }}>
        <div className="admin-seg">
          {[7, 30, 90].map((d) => <button key={d} className={days === d ? "on" : ""} onClick={() => setDays(d)}>{d} дн.</button>)}
        </div>
      </div>

      <div className="admin-tiles">
        {tiles.map((t) => (
          <div key={t.lbl} className="admin-tile">
            <div className="admin-tile-top"><span className="admin-tile-ic">{t.icon}</span><span className="lbl">{t.lbl}</span></div>
            <div className="num">{t.num}</div>
          </div>
        ))}
      </div>

      <div className="admin-grid2">
        <div className="admin-card2">
          <div className="admin-card2-h"><h3>Воронка</h3><span className="admin-hint" style={{ margin: 0 }}>за {days} дн.</span></div>
          <div className="admin-card2-b">
            <div className="admin-roles" style={{ marginBottom: 0 }}>
              {steps.map((s, i) => {
                const v = stats.funnel[s.k] || 0;
                return (
                  <div key={s.k} className="admin-rolerow">
                    <span className="admin-role-name"><span className="admin-role-dot" style={{ background: DONUT_PAL[i % DONUT_PAL.length] }} />{s.l}</span>
                    <span className="admin-role-track"><span className="admin-role-fill" style={{ width: `${(v / fmax) * 100}%`, background: DONUT_PAL[i % DONUT_PAL.length] }} /></span>
                    <b>{v}</b>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="admin-card2">
          <div className="admin-card2-h"><h3>Удержание</h3></div>
          <div className="admin-card2-b">
            <div className="admin-kbsum"><b>{stats.retention.rate}%</b> возвращаются</div>
            <div className="admin-states" style={{ marginTop: 16 }}>
              <div className="admin-state"><b>{stats.retention.peopleWithMessages}</b> писали</div>
              <div className="admin-state"><b>{stats.retention.returnedAnotherDay}</b> вернулись</div>
              <div className="admin-state"><b>{stats.totals.crisisEvents}</b> кризис-событий</div>
            </div>
            {ud && (
              <div className="admin-states" style={{ marginTop: 10 }}>
                <div className="admin-state"><b>{ud.insights.active}</b> активны</div>
                <div className="admin-state"><b>{ud.insights.atRisk}</b> под риском</div>
                <div className="admin-state"><b>{ud.insights.churned}</b> ушли</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {ud && (
        <div className="admin-card2" style={{ marginTop: 16 }}>
          <div className="admin-card2-h"><h3>Пользователи</h3><span className="admin-hint" style={{ margin: 0 }}>ср. {ud.insights.avgMsgs} сообщ. · показаны {users.length} из {ud.insights.total}</span></div>
          <div className="admin-card2-b" style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead><tr><th>Пользователь</th><th>Сообщений</th><th>Дней</th><th>Статус</th><th>Регистрация</th></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.uid}>
                    <td>{u.label}</td>
                    <td>{u.msgs}</td>
                    <td>{u.activeDays}</td>
                    <td><span className="admin-status-badge" style={{ color: STATUS[u.status]?.c }}><span className="admin-role-dot" style={{ background: STATUS[u.status]?.c }} />{STATUS[u.status]?.t || u.status}</span></td>
                    <td>{u.joinedAt ? fmtDate(u.joinedAt) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

type DataTable = { table: string; rows: number; title: string; desc: string };
function DataTab({ af }: { af: Fetcher }) {
  const [data, setData] = useState<{ tables: DataTable[]; totalTables: number; totalRows: number } | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let alive = true;
    af("/api/admin/data").then((r) => { if (!alive) return; if (!r || !r.ok) { setErr(true); return; } setData(r); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (err) return <div className="admin-hint">База данных недоступна — не получилось прочитать список таблиц.</div>;
  if (!data) return <div className="admin-hint">Загрузка…</div>;
  return (
    <div className="admin-subcontent">
      <p className="admin-sub">Всё, что реально хранится в твоей базе на сервере — прозрачно. Так видно, что уже собирается и что ещё можно собирать. Числа строк приблизительные (оценка БД).</p>
      <div className="admin-tiles" style={{ marginBottom: 18 }}>
        <div className="admin-tile"><div className="num">{data.totalTables}</div><div className="lbl">Таблиц</div></div>
        <div className="admin-tile"><div className="num">{data.totalRows.toLocaleString("ru-RU")}</div><div className="lbl">Строк всего (≈)</div></div>
      </div>
      {data.tables.map((t) => (
        <div key={t.table} className="admin-datarow">
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14.5 }}>{t.title}</div>
            <div className="admin-hint" style={{ margin: "3px 0 0" }}>{t.desc || ""} <code className="admin-id">{t.table}</code></div>
          </div>
          <div className="admin-datacount">≈ {t.rows.toLocaleString("ru-RU")}</div>
        </div>
      ))}
    </div>
  );
}

function ChatsTab({ chats, setChats, spaces, capDefs, groups, af, reload, onGoKb }: { chats: Chat[]; setChats: (u: (c: Chat[]) => Chat[]) => void; spaces: string[]; capDefs: CapDef[]; groups: string[]; af: Fetcher; reload: () => void; onGoKb: (sp: string) => void }) {
  const [selId, setSelId] = useState<string>("");
  const [sub, setSub] = useState<"cfg" | "caps" | "kb" | "hist">("cfg");
  const [newId, setNewId] = useState("");
  const [msg, setMsg] = useState("");
  const [cmds, setCmds] = useState<Record<string, CustomCmd[]>>({});
  const [capsById, setCapsById] = useState<Record<string, Caps>>({});

  const grp = groups.length ? groups : Array.from(new Set(capDefs.map((c) => c.group)));
  const selected = chats.find((c) => c.chatId === selId) || null;

  function set(id: string, patch: Partial<Chat>) { setChats((cs) => cs.map((c) => (c.chatId === id ? { ...c, ...patch } : c))); }
  function openProject(c: Chat) {
    setSelId(c.chatId); setSub("cfg");
    setCmds((m) => (m[c.chatId] ? m : { ...m, [c.chatId]: parseCmds(c.commands) }));
    setCapsById((m) => (m[c.chatId] ? m : { ...m, [c.chatId]: { ...(c.resolvedCaps || {}) } }));
    if (BUILTIN_TITLES[c.role]) set(c.chatId, { role: BUILTIN_TITLES[c.role] });
  }
  const chatCmds = (c: Chat) => cmds[c.chatId] ?? parseCmds(c.commands);
  function setChatCmds(id: string, list: CustomCmd[]) { setCmds((m) => ({ ...m, [id]: list })); }
  const getCaps = (c: Chat) => capsById[c.chatId] ?? c.resolvedCaps ?? {};
  function setCap(id: string, key: string, v: boolean) { setCapsById((m) => ({ ...m, [id]: { ...(m[id] || {}), [key]: v } })); }
  function setBlock(id: string, group: string, v: boolean) {
    setCapsById((m) => { const cur = { ...(m[id] || {}) }; for (const d of capDefs) if (d.group === group && !d.soon) cur[d.key] = v; return { ...m, [id]: cur }; });
  }
  function enabledCount(c: Chat): number {
    const caps = c.resolvedCaps || {};
    return capDefs.filter((d) => !d.soon && caps[d.key]).length;
  }

  async function save(c: Chat) {
    const commands = JSON.stringify(chatCmds(c).filter((x) => x.cmd.trim()));
    const caps = JSON.stringify(getCaps(c));
    const r = await af("/api/admin/chats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...c, commands, caps }) });
    if (r?.ok) set(c.chatId, { commands, caps });
    setMsg(r?.ok ? "Сохранено ✓" : "Не сохранилось"); setTimeout(() => setMsg(""), 1500);
  }
  async function addById() {
    const id = newId.trim(); if (!id) return;
    const r = await af("/api/admin/chats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chatId: id, role: "Поддержка", enabled: true, caps: JSON.stringify({ support: true, commands: true, crisis: true }) }) });
    setNewId("");
    setMsg(r?.ok ? "Проект добавлен ✓" : "Не удалось добавить"); setTimeout(() => setMsg(""), 1500);
    reload();
  }
  const spaceOpts = (cur: string) => Array.from(new Set([...spaces, cur, "default"])).filter(Boolean).map((s) => ({ v: s, t: s }));

  // --- Сетка обложек проектов ---
  if (!selected) {
    return (
      <div className="admin-subcontent">
        <div className="admin-row" style={{ marginBottom: 18 }}>
          <input placeholder="Добавить проект по id чата (напр. -1001877817129)" value={newId} onChange={(e) => setNewId(e.target.value)} className="admin-inp" style={{ width: 360 }} />
          <button onClick={addById} className="admin-btn">Добавить</button>
          {msg && <span style={{ color: "var(--accent)", alignSelf: "center" }}>{msg}</span>}
        </div>
        {chats.length === 0 && <div className="admin-hint">Пока пусто. Добавь проект по id чата или напиши что-нибудь в чат, где есть Ася.</div>}
        <div className="admin-grid">
          {chats.map((c) => (
            <div key={c.chatId} className="admin-proj" onClick={() => openProject(c)}>
              <div className="admin-proj-title">{c.title || "Без названия"}</div>
              <div className="admin-proj-role">{BUILTIN_TITLES[c.role] || c.role}</div>
              <div className="admin-proj-meta">
                <span><span className={`admin-dot ${c.enabled ? "on" : "off"}`} />{c.enabled ? "активен" : "выключен"}</span>
                <span><IconDoc /> {c.articleCount ?? 0} статей</span>
                {c.repoUrl && <span><GithubIcon /> GitHub</span>}
                <span><IconGear /> {enabledCount(c)} функций</span>
                <span><IconChat /> {c.msgCount ?? 0} сообщений</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --- Страница проекта ---
  const c = selected;
  const caps = getCaps(c);
  return (
    <div className="admin-subcontent">
      <div className="admin-crumb"><a onClick={() => setSelId("")}>Проекты</a> <span style={{ opacity: 0.5 }}>›</span> <b>{c.title || "Без названия"}</b>{msg && <span style={{ color: "var(--accent)", marginLeft: 10 }}>{msg}</span>}</div>

      <div className="admin-subtabs">
        {([["cfg", "Настройка"], ["caps", "Функции"], ["kb", "База знаний"], ["hist", "История"]] as const).map(([s, l]) => (
          <div key={s} className={`admin-subtab${sub === s ? " active" : ""}`} onClick={() => setSub(s)}>{l}</div>
        ))}
      </div>

      {sub === "cfg" && (
        <div className="admin-subcontent">
          <div className="admin-fields">
            <label className="admin-lbl">Название роли<input value={BUILTIN_TITLES[c.role] || c.role} onChange={(e) => set(c.chatId, { role: e.target.value })} className="admin-inp" style={{ width: 260 }} placeholder="напр. Поддержка BTS" /></label>
            <label className="admin-lbl">Проект — раздел базы знаний<Dropdown value={c.space} options={spaceOpts(c.space)} onChange={(v) => set(c.chatId, { space: v })} width={220} /></label>
            <label className="admin-lbl" style={{ alignSelf: "flex-end" }}><span style={{ display: "flex", alignItems: "center", gap: 8 }}><Toggle on={c.enabled} onChange={(b) => set(c.chatId, { enabled: b })} /> проект активен</span></label>
          </div>

          <div style={{ marginTop: 16 }}>
            <div className="admin-lbl" style={{ marginBottom: 6 }}>Команды в чате</div>
            <div className="admin-hint" style={{ marginTop: 0, marginBottom: 10 }}>Встроенные (если включён блок «Поддержка» → «Команды»): <b>/ask &lt;вопрос&gt;</b>, <b>/rules</b>, <b>/help</b>, <b>/setup</b> (для админов). Ниже — свои команды; в ответе можно вставить <b>{"{arg}"}</b> — текст после команды.</div>
            {chatCmds(c).map((cm, idx) => (
              <div key={idx} className="admin-cmd-row">
                <input className="admin-inp" style={{ width: 150 }} placeholder="/команда" value={cm.cmd} onChange={(e) => { const l = [...chatCmds(c)]; l[idx] = { ...l[idx], cmd: e.target.value }; setChatCmds(c.chatId, l); }} />
                <input className="admin-inp" style={{ flex: 1, minWidth: 220 }} placeholder="ответ (можно с {arg})" value={cm.reply} onChange={(e) => { const l = [...chatCmds(c)]; l[idx] = { ...l[idx], reply: e.target.value }; setChatCmds(c.chatId, l); }} />
                <button className="admin-btn ghost" style={{ padding: "8px 12px" }} onClick={() => setChatCmds(c.chatId, chatCmds(c).filter((_, j) => j !== idx))}>✕</button>
              </div>
            ))}
            <button className="admin-btn ghost" style={{ padding: "8px 14px", fontSize: 13 }} onClick={() => setChatCmds(c.chatId, [...chatCmds(c), { cmd: "", reply: "" }])}>+ команда</button>
          </div>

          <RepoRow c={c} set={set} af={af} />
          <textarea placeholder="Свои правила чата (опц., переопределяют дефолтные; /rules покажет их)" value={c.rules || ""} onChange={(e) => set(c.chatId, { rules: e.target.value })} rows={3} className="admin-inp" style={{ width: "100%", marginTop: 12, resize: "vertical" }} />
          <div className="admin-hint" style={{ marginTop: 10 }}>id чата: <code className="admin-id">{c.chatId}</code></div>
          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 12 }}><button onClick={() => save(c)} className="admin-btn accent">Сохранить</button>{msg && <span style={{ color: "var(--accent)" }}>{msg}</span>}</div>
        </div>
      )}

      {sub === "caps" && (
        <div className="admin-subcontent">
          <div className="admin-lbl" style={{ marginBottom: 8 }}>Возможности Аси в этом проекте — включай блоки и функции</div>
          {grp.map((g) => {
            const defs = capDefs.filter((d) => d.group === g);
            const active = defs.filter((d) => !d.soon);
            const onCount = active.filter((d) => caps[d.key]).length;
            const allOn = active.length > 0 && onCount === active.length;
            return (
              <div key={g} className="admin-block">
                <div className="admin-block-head">
                  <span><b>{g}</b> <span className="admin-hint" style={{ margin: 0 }}>· {onCount}/{active.length} включено</span></span>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}><span className="admin-hint" style={{ margin: 0 }}>весь блок</span><Toggle on={allOn} onChange={(v) => setBlock(c.chatId, g, v)} /></span>
                </div>
                <div className="admin-caps">
                  {defs.map((d) => (
                    <div key={d.key} className={`admin-cap${d.soon ? " soon" : ""}`}>
                      <div className="admin-caprow">
                        <Toggle on={d.soon ? false : Boolean(caps[d.key])} onChange={(v) => { if (!d.soon) setCap(c.chatId, d.key, v); }} />
                        {d.title}{d.soon && <span className="admin-soon">скоро</span>}
                      </div>
                      {d.hint && <div className="admin-cap-hint">{d.hint}</div>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          <div className="admin-hint" style={{ marginTop: 4 }}>Функции с меткой «скоро» пока не работают — включим, когда будут готовы. Кризис-поддержка (блок «Поддержка») срабатывает, только если включена.</div>
          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 12 }}><button onClick={() => save(c)} className="admin-btn accent">Сохранить</button>{msg && <span style={{ color: "var(--accent)" }}>{msg}</span>}</div>
        </div>
      )}

      {sub === "kb" && <ChatKb c={c} af={af} onGoKb={onGoKb} />}
      {sub === "hist" && <ChatHistory chatId={c.chatId} af={af} />}
    </div>
  );
}

function RepoRow({ c, set, af }: { c: Chat; set: (id: string, patch: Partial<Chat>) => void; af: Fetcher }) {
  const [st, setSt] = useState<{ loading?: boolean; ok?: boolean; info?: string; preview?: string }>({});
  async function check() {
    if (!c.repoUrl) return;
    setSt({ loading: true });
    const r = await af("/api/admin/chats/repo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: c.repoUrl }) });
    if (!r || !r.ok) { setSt({ ok: false, info: r?.reason === "bad_url" ? "Не распознал ссылку." : "Не удалось прочитать репозиторий — проверь, что он публичный." }); return; }
    setSt({ ok: true, info: `${r.repo} — прочитано ${r.chars} символов`, preview: r.preview });
  }
  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
        <input placeholder="Ссылка на репозиторий (GitHub) — опционально" value={c.repoUrl || ""} onChange={(e) => set(c.chatId, { repoUrl: e.target.value })} className="admin-inp" style={{ flex: 1, minWidth: 240 }} />
        <button onClick={check} className="admin-btn ghost" style={{ padding: "9px 14px", fontSize: 13 }} disabled={!c.repoUrl || st.loading}>{st.loading ? "Читаю…" : "Проверить"}</button>
      </div>
      {st.info && <div className="admin-hint" style={{ color: st.ok ? "var(--text-soft)" : "var(--bubble-u1)" }}>{st.info}</div>}
      {st.preview && <div className="admin-digest" style={{ marginTop: 8 }}><div style={{ whiteSpace: "pre-wrap", fontSize: 12.5, lineHeight: 1.5, color: "var(--text-soft)" }}>{st.preview}…</div></div>}
    </div>
  );
}

function ChatKb({ c, af, onGoKb }: { c: Chat; af: Fetcher; onGoKb: (sp: string) => void }) {
  const [arts, setArts] = useState<Article[] | null>(null);
  const [digest, setDigest] = useState<{ loading?: boolean; text?: string; count?: number; err?: string }>({});
  useEffect(() => {
    let alive = true;
    af(`/api/admin/knowledge?space=${encodeURIComponent(c.space)}`).then((r) => { if (alive && r && !r.error) setArts(r.articles || []); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.space]);
  async function makeDigest() {
    setDigest({ loading: true });
    const r = await af("/api/admin/chats/digest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chatId: c.chatId, space: c.space }) });
    if (!r || !r.ok) { setDigest({ err: r?.count === 0 ? "Пока нет сохранённых сообщений для выжимки." : "Не получилось сделать выжимку." }); return; }
    setDigest({ text: r.digest, count: r.count });
  }
  return (
    <div className="admin-subcontent">
      <div className="admin-history" style={{ borderTop: "none", paddingTop: 0, marginTop: 0 }}>
        <span className="admin-hist-stat">Раздел «{c.space}»: {arts ? `${arts.length} статей` : "загрузка…"}</span>
        <span style={{ display: "flex", gap: 8 }}>
          <button onClick={makeDigest} className="admin-btn ghost" style={{ padding: "7px 14px", fontSize: 13 }} disabled={digest.loading}>{digest.loading ? "Делаю выжимку…" : "Сделать выжимку"}</button>
          <button onClick={() => onGoKb(c.space)} className="admin-btn ghost" style={{ padding: "7px 14px", fontSize: 13 }}>Открыть раздел →</button>
        </span>
      </div>
      {digest.err && <div className="admin-hint" style={{ color: "var(--bubble-u1)" }}>{digest.err}</div>}
      {digest.text && <div className="admin-digest" style={{ marginTop: 10 }}><div className="admin-hint" style={{ marginTop: 0, marginBottom: 8 }}>Выжимка по {digest.count} сообщениям сохранена в базу знаний раздела как авто-статья.</div><div style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.5, color: "var(--text-soft)" }}>{digest.text}</div></div>}
      <div style={{ marginTop: 12 }}>
        {arts && arts.length === 0 && <div className="admin-hint">В этом разделе пока нет статей.</div>}
        {arts && arts.map((a) => (
          <div key={a.id} style={{ padding: "10px 0", borderTop: "1px solid var(--line)" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}><b style={{ fontSize: 14 }}>{a.title}</b>{a.source === "history" && <code className="admin-id" style={{ color: "var(--accent)" }}>из истории</code>}</div>
            <div style={{ color: "var(--text-soft)", fontSize: 13, marginTop: 4, whiteSpace: "pre-wrap" }}>{a.body.slice(0, 240)}{a.body.length > 240 ? "…" : ""}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChatHistory({ chatId, af }: { chatId: string; af: Fetcher }) {
  const [msgs, setMsgs] = useState<HistMsg[] | null>(null);
  useEffect(() => {
    let alive = true;
    af(`/api/admin/chats/history?chatId=${encodeURIComponent(chatId)}`).then((r) => { if (alive && r && !r.error) setMsgs(r.messages || []); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);
  if (!msgs) return <div className="admin-hint">Загрузка…</div>;
  if (msgs.length === 0) return <div className="admin-hint">История пока пустая — Ася сохраняет сообщения, начиная с подключения проекта.</div>;
  return (
    <div className="admin-subcontent" style={{ maxHeight: 460, overflowY: "auto" }}>
      <div className="admin-hint" style={{ marginTop: 0 }}>Последние {msgs.length} сообщений (Ася хранит их у себя).</div>
      {msgs.map((m, i) => (
        <div key={i} className={`admin-msg${m.fromBot ? " bot" : ""}`}>
          <div className="who">{m.fromBot ? "Ася" : m.userName || "участник"} · {fmtDate(m.createdAt)}</div>
          <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>
        </div>
      ))}
    </div>
  );
}

function KbTab({ af, initSpace }: { af: Fetcher; initSpace: string }) {
  const [space, setSpace] = useState(initSpace || "");
  const [counts, setCounts] = useState<SectionCount[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<{ id?: string; space: string; title: string; body: string }>({ space: initSpace || "default", title: "", body: "" });
  const [msg, setMsg] = useState("");

  async function load(s = space, query = q) {
    const parts: string[] = [];
    if (s) parts.push(`space=${encodeURIComponent(s)}`);
    if (query.trim()) parts.push(`q=${encodeURIComponent(query.trim())}`);
    const r = await af(`/api/admin/knowledge${parts.length ? `?${parts.join("&")}` : ""}`);
    if (!r || r.error) return;
    setArticles(r.articles || []);
    setCounts(r.counts || []);
  }
  useEffect(() => { void load(space, ""); /* eslint-disable-next-line */ }, []);

  function pick(s: string) { setSpace(s); setEdit((e) => ({ ...e, space: s || e.space || "default" })); void load(s, q); }
  async function save() {
    if (!edit.title.trim() || !edit.body.trim()) { setMsg("Заголовок и текст обязательны."); return; }
    const r = await af("/api/admin/knowledge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: edit.id, space: edit.space || "default", title: edit.title, body: edit.body }) });
    if (!r?.ok) { setMsg("Не сохранилось."); return; }
    setEdit({ space: edit.space || "default", title: "", body: "" }); setMsg(""); void load();
  }
  async function del(id: string) { await af(`/api/admin/knowledge?id=${encodeURIComponent(id)}`, { method: "DELETE" }); void load(); }

  const total = counts.reduce((s, c) => s + c.count, 0);
  const editOpts = Array.from(new Set([...counts.map((c) => c.space), edit.space, "default"])).filter(Boolean).map((s) => ({ v: s, t: s }));

  return (
    <div className="admin-subcontent">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <button className={`admin-secpill${space === "" ? " active" : ""}`} onClick={() => pick("")}>Все <span className="admin-seccount">{total}</span></button>
        {counts.map((c) => (
          <button key={c.space} className={`admin-secpill${space === c.space ? " active" : ""}`} onClick={() => pick(c.space)}>{c.space} <span className="admin-seccount">{c.count}</span></button>
        ))}
      </div>

      <div className="admin-row">
        <input placeholder="Поиск по статьям…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") load(space, q); }} className="admin-inp" style={{ width: 320 }} />
        <button onClick={() => load(space, q)} className="admin-btn ghost">Искать</button>
        {q && <button onClick={() => { setQ(""); load(space, ""); }} className="admin-btn ghost">Сбросить</button>}
        <span className="admin-hint" style={{ marginTop: 0, alignSelf: "center" }}>Найдено: {articles.length}</span>
      </div>

      <div className="admin-card">
        <div style={{ fontWeight: 600, marginBottom: 12 }}>{edit.id ? "Редактировать статью" : "Новая статья"}</div>
        <label className="admin-lbl" style={{ marginBottom: 10 }}>Раздел статьи<Dropdown value={edit.space} options={editOpts.length ? editOpts : [{ v: "default", t: "default" }]} onChange={(v) => setEdit({ ...edit, space: v })} width={220} /></label>
        <input placeholder="Заголовок" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} className="admin-inp" style={{ width: "100%", marginBottom: 10 }} />
        <textarea placeholder="Текст ответа / инструкция" value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} rows={7} className="admin-inp" style={{ width: "100%", resize: "vertical" }} />
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <button onClick={save} className="admin-btn accent">{edit.id ? "Сохранить" : "Добавить"}</button>
          {edit.id && <button onClick={() => setEdit({ space: edit.space, title: "", body: "" })} className="admin-btn ghost">Отмена</button>}
          {msg && <span style={{ color: "var(--bubble-u1)", alignSelf: "center" }}>{msg}</span>}
        </div>
      </div>

      {articles.length === 0 && <div className="admin-hint">Ничего не найдено. Добавь статью — Ася сразу начнёт отвечать по ней.</div>}
      {articles.map((a) => (
        <div key={a.id} className="admin-card" style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
            <b style={{ fontSize: 15.5 }}>{a.title}</b>
            <span style={{ display: "flex", gap: 8, flex: "0 0 auto", alignItems: "center" }}>
              <code className="admin-id">{a.space}</code>
              {a.source === "history" && <code className="admin-id" style={{ color: "var(--accent)" }}>из истории</code>}
              <button onClick={() => setEdit({ id: a.id, space: a.space, title: a.title, body: a.body })} className="admin-btn ghost" style={{ padding: "5px 12px", fontSize: 12.5 }}>ред.</button>
              <button onClick={() => del(a.id)} className="admin-btn ghost" style={{ padding: "5px 12px", fontSize: 12.5, color: "var(--bubble-u1)" }}>удалить</button>
            </span>
          </div>
          <div style={{ color: "var(--text-soft)", fontSize: 13.5, marginTop: 8, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{a.body.slice(0, 400)}{a.body.length > 400 ? "…" : ""}</div>
        </div>
      ))}
    </div>
  );
}
