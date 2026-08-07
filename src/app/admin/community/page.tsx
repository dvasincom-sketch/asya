"use client";

import { useEffect, useState } from "react";

type Caps = Record<string, boolean>;
type CapDef = { key: string; title: string; hint: string; group: string };
type Role = { key: string; title: string; caps: Caps; builtin: boolean };
type CustomCmd = { cmd: string; reply: string };
type Chat = { chatId: string; title: string | null; role: string; space: string; rules: string | null; repoUrl: string | null; enabled: boolean; commands?: string | null; msgCount?: number; lastAt?: string | null };
type Article = { id: string; space: string; title: string; body: string; source?: string | null };
type Overview = { chatsConnected: number; chatsTotal: number; messagesStored: number; messagesFromAsya: number; articles: number; spaces: number };
type HistMsg = { userName: string | null; text: string; fromBot: boolean; createdAt: string };
type SectionCount = { space: string; count: number };
type Fetcher = (path: string, init?: RequestInit) => Promise<any>;

const KEY_STORE = "asya_admin_key";

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); } catch { return "—"; }
}
function parseCmds(json?: string | null): CustomCmd[] {
  try { const p = JSON.parse(json || "[]"); return Array.isArray(p) ? p.map((x) => ({ cmd: String(x.cmd || ""), reply: String(x.reply || "") })) : []; } catch { return []; }
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
  const [tab, setTab] = useState<"dash" | "chats" | "kb" | "roles">("dash");
  const [err, setErr] = useState("");
  const [kbInit, setKbInit] = useState("");

  const [overview, setOverview] = useState<Overview | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [spaces, setSpaces] = useState<string[]>([]);
  const [seedErr, setSeedErr] = useState("");
  const [roles, setRoles] = useState<Role[]>([]);
  const [capDefs, setCapDefs] = useState<CapDef[]>([]);
  const [groups, setGroups] = useState<string[]>([]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    let k = q.get("key") || "";
    if (!k) { try { k = window.localStorage.getItem(KEY_STORE) || ""; } catch { k = ""; } }
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
    if (rl && !rl.error) { setRoles(rl.roles || []); setCapDefs(rl.caps || []); setGroups(rl.groups || []); }
    setLoaded(true);
  }
  function logout() {
    try { window.localStorage.removeItem(KEY_STORE); } catch { /* ignore */ }
    setKey(""); setLoaded(false); setOverview(null); setChats([]); setRoles([]);
  }

  const roleOpts = roles.length ? roles.map((r) => ({ v: r.key, t: r.title })) : [{ v: "support", t: "Поддержка" }, { v: "both", t: "Модерация + поддержка" }];

  return (
    <div className="admin-wrap">
      <h1 className="admin-h1">Ася — панель управления</h1>
      <p className="admin-sub">Комьюнити-менеджер, поддержка и база знаний в одном месте.</p>

      {!loaded && (
        <div className="admin-row">
          <input placeholder="ADMIN_KEY" value={key} onChange={(e) => setKey(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") loadAll(); }} className="admin-inp" style={{ width: 260 }} />
          <button onClick={() => loadAll()} className="admin-btn">Войти</button>
          {err && <span style={{ color: "var(--bubble-u1)", alignSelf: "center" }}>{err}</span>}
        </div>
      )}

      {seedErr && <div className="admin-err">База данных сейчас недоступна — часть данных может не отображаться, а изменения не сохранятся, пока база не поднимется. Детали: {seedErr}</div>}

      {loaded && (
        <>
          <div className="admin-tabs">
            {([["dash", "Дашборд"], ["chats", "Чаты"], ["kb", "База знаний"], ["roles", "Роли"]] as const).map(([t, label]) => (
              <button key={t} className={`admin-tab${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>{label}</button>
            ))}
            <button className="admin-btn ghost" style={{ marginLeft: "auto", padding: "9px 14px", fontSize: 13 }} onClick={logout}>Сменить ключ</button>
          </div>

          {tab === "dash" && <DashTab overview={overview} onRefresh={() => loadAll()} />}
          {tab === "chats" && <ChatsTab chats={chats} setChats={setChats} spaces={spaces} roles={roles} roleOpts={roleOpts} capDefs={capDefs} af={af} reload={() => loadAll()} onGoKb={(sp) => { setKbInit(sp); setTab("kb"); }} />}
          {tab === "kb" && <KbTab af={af} initSpace={kbInit} />}
          {tab === "roles" && <RolesTab roles={roles} capDefs={capDefs} groups={groups} af={af} reload={() => loadAll()} />}
        </>
      )}
    </div>
  );
}

function DashTab({ overview, onRefresh }: { overview: Overview | null; onRefresh: () => void }) {
  if (!overview) return <div className="admin-hint">Нет данных.</div>;
  const tiles: { num: number; lbl: string }[] = [
    { num: overview.chatsConnected, lbl: "Активных чатов" },
    { num: overview.chatsTotal, lbl: "Всего чатов" },
    { num: overview.messagesStored, lbl: "Сообщений в истории" },
    { num: overview.messagesFromAsya, lbl: "Ответов Аси" },
    { num: overview.articles, lbl: "Статей в базе" },
    { num: overview.spaces, lbl: "Разделов базы" },
  ];
  return (
    <div className="admin-subcontent">
      <div className="admin-tiles">
        {tiles.map((t) => (<div key={t.lbl} className="admin-tile"><div className="num">{t.num}</div><div className="lbl">{t.lbl}</div></div>))}
      </div>
      <div style={{ marginTop: 16 }}><button onClick={onRefresh} className="admin-btn ghost">Обновить</button></div>
      <p className="admin-hint">История сообщений копится с момента подключения чата (Telegram не отдаёт переписку задним числом). «Ответов Аси» — сколько раз она ответила по существу (поддержка, команды, кризис).</p>
    </div>
  );
}

function CapsBadge({ caps, capDefs }: { caps: Caps; capDefs: CapDef[] }) {
  const on = capDefs.filter((d) => caps[d.key]);
  return (
    <div className="admin-rolebadge">
      {on.length === 0 && <span className="admin-chip">ничего не делает</span>}
      {on.map((d) => <span key={d.key} className="admin-chip on">{d.title}</span>)}
    </div>
  );
}

function ChatsTab({ chats, setChats, spaces, roles, roleOpts, capDefs, af, reload, onGoKb }: { chats: Chat[]; setChats: (u: (c: Chat[]) => Chat[]) => void; spaces: string[]; roles: Role[]; roleOpts: { v: string; t: string }[]; capDefs: CapDef[]; af: Fetcher; reload: () => void; onGoKb: (sp: string) => void }) {
  const [openId, setOpenId] = useState<string>("");
  const [sub, setSub] = useState<"cfg" | "kb" | "hist">("cfg");
  const [newId, setNewId] = useState("");
  const [msg, setMsg] = useState("");
  const [cmds, setCmds] = useState<Record<string, CustomCmd[]>>({});

  function set(id: string, patch: Partial<Chat>) { setChats((cs) => cs.map((c) => (c.chatId === id ? { ...c, ...patch } : c))); }
  function openChat(c: Chat) {
    const willOpen = openId !== c.chatId;
    setOpenId(willOpen ? c.chatId : ""); setSub("cfg");
    if (willOpen) setCmds((m) => (m[c.chatId] ? m : { ...m, [c.chatId]: parseCmds(c.commands) }));
  }
  const chatCmds = (c: Chat) => cmds[c.chatId] ?? parseCmds(c.commands);
  function setChatCmds(id: string, list: CustomCmd[]) { setCmds((m) => ({ ...m, [id]: list })); }

  async function save(c: Chat) {
    const commands = JSON.stringify(chatCmds(c).filter((x) => x.cmd.trim()));
    const r = await af("/api/admin/chats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...c, commands }) });
    if (r?.ok) set(c.chatId, { commands });
    setMsg(r?.ok ? "Сохранено ✓" : "Не сохранилось"); setTimeout(() => setMsg(""), 1500);
  }
  async function addById() {
    const id = newId.trim(); if (!id) return;
    const r = await af("/api/admin/chats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chatId: id, role: "support", enabled: true }) });
    setNewId("");
    setMsg(r?.ok ? "Чат добавлен ✓" : "Не удалось добавить"); setTimeout(() => setMsg(""), 1500);
    reload();
  }
  const spaceOpts = (cur: string) => Array.from(new Set([...spaces, cur, "default"])).filter(Boolean).map((s) => ({ v: s, t: s }));

  return (
    <div className="admin-subcontent">
      <div className="admin-row" style={{ marginBottom: 18 }}>
        <input placeholder="Добавить чат по id (напр. -1001877817129)" value={newId} onChange={(e) => setNewId(e.target.value)} className="admin-inp" style={{ width: 340 }} />
        <button onClick={addById} className="admin-btn">Добавить</button>
        {msg && <span style={{ color: "var(--accent)", alignSelf: "center" }}>{msg}</span>}
      </div>
      {chats.length === 0 && <div className="admin-hint">Пока пусто. Добавь чат по id или напиши что-нибудь в чат, где есть Ася.</div>}
      {chats.map((c) => {
        const open = openId === c.chatId;
        const role = roles.find((r) => r.key === c.role);
        return (
          <div key={c.chatId} className="admin-card">
            <div className="admin-card-head admin-expand" onClick={() => openChat(c)} style={{ marginBottom: open ? 16 : 0, justifyContent: "space-between" }}>
              <span style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                <b>{c.title || "Без названия"}</b>
                <code className="admin-id">{c.chatId}</code>
                {!c.enabled && <code className="admin-id" style={{ color: "var(--bubble-u1)" }}>выключена</code>}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="admin-hint" style={{ margin: 0 }}>{roleOpts.find((r) => r.v === c.role)?.t || c.role}</span>
                <span style={{ opacity: 0.5, transform: open ? "rotate(180deg)" : "none", transition: "0.2s" }}>▾</span>
              </span>
            </div>

            {open && (
              <>
                <div className="admin-subtabs">
                  {([["cfg", "Настройка"], ["kb", "База знаний"], ["hist", "История"]] as const).map(([s, l]) => (
                    <div key={s} className={`admin-subtab${sub === s ? " active" : ""}`} onClick={() => setSub(s)}>{l}</div>
                  ))}
                </div>

                {sub === "cfg" && (
                  <div className="admin-subcontent">
                    <div className="admin-fields">
                      <label className="admin-lbl">Роль<Dropdown value={c.role} options={roleOpts} onChange={(v) => set(c.chatId, { role: v })} width={260} /></label>
                      <label className="admin-lbl">Раздел базы знаний<Dropdown value={c.space} options={spaceOpts(c.space)} onChange={(v) => set(c.chatId, { space: v })} width={200} /></label>
                      <label className="admin-lbl" style={{ alignSelf: "flex-end" }}><span style={{ display: "flex", alignItems: "center", gap: 8 }}><Toggle on={c.enabled} onChange={(b) => set(c.chatId, { enabled: b })} /> включена</span></label>
                    </div>

                    <div style={{ marginTop: 14 }}>
                      <div className="admin-lbl" style={{ marginBottom: 0 }}>Что сейчас делает роль в этом чате</div>
                      {c.enabled ? <CapsBadge caps={role?.caps || {}} capDefs={capDefs} /> : <div className="admin-rolebadge"><span className="admin-chip">чат выключен — Ася не реагирует</span></div>}
                      <div className="admin-hint">Изменить набор возможностей роли — вкладка «Роли». Кризисные сообщения Ася поддерживает всегда, если у роли включена кризис-поддержка.</div>
                    </div>

                    <div style={{ marginTop: 16 }}>
                      <div className="admin-lbl" style={{ marginBottom: 6 }}>Команды в чате</div>
                      <div className="admin-hint" style={{ marginTop: 0, marginBottom: 10 }}>Встроенные (если у роли включены «Команды»): <b>/ask &lt;вопрос&gt;</b>, <b>/rules</b>, <b>/help</b>, <b>/setup</b> (для админов). Ниже — свои команды; в ответе можно вставить <b>{"{arg}"}</b> — текст после команды.</div>
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
                    <div style={{ marginTop: 14 }}><button onClick={() => save(c)} className="admin-btn accent">Сохранить</button></div>
                  </div>
                )}

                {sub === "kb" && <ChatKb c={c} af={af} onGoKb={onGoKb} />}
                {sub === "hist" && <ChatHistory chatId={c.chatId} af={af} />}
              </>
            )}
          </div>
        );
      })}
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
  if (msgs.length === 0) return <div className="admin-hint">История пока пустая — Ася сохраняет сообщения, начиная с подключения чата.</div>;
  return (
    <div className="admin-subcontent" style={{ maxHeight: 420, overflowY: "auto" }}>
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

function RolesTab({ roles, capDefs, groups, af, reload }: { roles: Role[]; capDefs: CapDef[]; groups: string[]; af: Fetcher; reload: () => void }) {
  const [local, setLocal] = useState<Role[]>(roles);
  const [msg, setMsg] = useState("");
  const [nk, setNk] = useState(""); const [nt, setNt] = useState("");
  const [nc, setNc] = useState<Caps>({});
  useEffect(() => { setLocal(roles); }, [roles]);

  const grp = groups.length ? groups : Array.from(new Set(capDefs.map((c) => c.group)));
  function setCap(key: string, cap: string, v: boolean) { setLocal((rs) => rs.map((r) => (r.key === key ? { ...r, caps: { ...r.caps, [cap]: v } } : r))); }
  async function save(r: Role) {
    const res = await af("/api/admin/roles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: r.key, title: r.title, caps: r.caps, builtin: r.builtin }) });
    setMsg(res?.ok ? `Роль «${r.title}» сохранена ✓` : "Не сохранилось"); setTimeout(() => setMsg(""), 1600);
  }
  async function addRole() {
    if (!nk.trim() || !nt.trim()) { setMsg("Нужны ключ и название роли."); return; }
    const res = await af("/api/admin/roles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: nk, title: nt, caps: nc }) });
    if (!res?.ok) { setMsg("Не получилось создать роль."); return; }
    setNk(""); setNt(""); setNc({}); reload();
  }

  function CapGrid({ caps, onToggle }: { caps: Caps; onToggle: (key: string, v: boolean) => void }) {
    return (
      <>
        {grp.map((g) => (
          <div key={g} style={{ marginTop: 6 }}>
            <div className="admin-grouplbl">{g}</div>
            <div className="admin-caps">
              {capDefs.filter((d) => d.group === g).map((d) => (
                <div key={d.key} className="admin-cap">
                  <div className="admin-caprow"><Toggle on={Boolean(caps[d.key])} onChange={(v) => onToggle(d.key, v)} /> {d.title}</div>
                  {d.hint && <div className="admin-cap-hint">{d.hint}</div>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </>
    );
  }

  return (
    <div className="admin-subcontent">
      <p className="admin-sub">Роль — это именованный набор возможностей. Собери нужную комбинацию и сохрани, или заведи новую роль под свой сценарий. Чаты выбирают роль в своей настройке.</p>
      {msg && <div style={{ color: "var(--accent)", marginBottom: 12 }}>{msg}</div>}

      {local.map((r) => (
        <div key={r.key} className="admin-card">
          <div className="admin-card-head"><b>{r.title}</b><code className="admin-id">{r.key}</code>{r.builtin && <code className="admin-id">встроенная</code>}</div>
          <CapGrid caps={r.caps} onToggle={(key, v) => setCap(r.key, key, v)} />
          <div style={{ marginTop: 14 }}><button onClick={() => save(r)} className="admin-btn accent">Сохранить</button></div>
        </div>
      ))}

      <div className="admin-card">
        <div style={{ fontWeight: 600, marginBottom: 12 }}>Новая роль</div>
        <div className="admin-row">
          <input placeholder="ключ (лат., напр. welcome)" value={nk} onChange={(e) => setNk(e.target.value)} className="admin-inp" style={{ width: 220 }} />
          <input placeholder="Название" value={nt} onChange={(e) => setNt(e.target.value)} className="admin-inp" style={{ width: 260 }} />
        </div>
        <CapGrid caps={nc} onToggle={(key, v) => setNc((p) => ({ ...p, [key]: v }))} />
        <div style={{ marginTop: 14 }}><button onClick={addRole} className="admin-btn accent">Создать роль</button></div>
      </div>
    </div>
  );
}
