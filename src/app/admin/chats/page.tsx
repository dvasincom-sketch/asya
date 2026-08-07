"use client";

import { useState } from "react";

type Chat = { chatId: string; title: string | null; role: string; space: string; rules: string | null; repoUrl: string | null; enabled: boolean };

const ROLES = [
  { v: "off", t: "Выключена" },
  { v: "support", t: "Поддержка (без модерации)" },
  { v: "moderation", t: "Модерация" },
  { v: "both", t: "Модерация + поддержка" },
];

function Dropdown({ value, options, onChange, width }: { value: string; options: { v: string; t: string }[]; onChange: (v: string) => void; width?: number }) {
  const [open, setOpen] = useState(false);
  const cur = options.find((o) => o.v === value);
  return (
    <div style={{ position: "relative", width: width || 240 }}>
      <button type="button" onClick={() => setOpen((o) => !o)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, background: "var(--glass)", border: "1px solid var(--line)", borderRadius: 12, padding: "10px 13px", color: "var(--text)", fontSize: 14, cursor: "pointer", textAlign: "left" }}>
        <span>{cur?.t || value}</span><span style={{ opacity: 0.5, transform: open ? "rotate(180deg)" : "none", transition: "0.2s" }}>▾</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 30, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: 6, boxShadow: "0 20px 50px -12px rgba(0,0,0,.6)", maxHeight: 260, overflowY: "auto" }}>
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

export default function ChatsAdmin() {
  const [key, setKey] = useState("");
  const [chats, setChats] = useState<Chat[]>([]);
  const [spaces, setSpaces] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState("");
  const [seedErr, setSeedErr] = useState("");
  const [newId, setNewId] = useState("");

  async function load() {
    const r = await fetch(`/api/admin/chats?key=${encodeURIComponent(key)}`).then((x) => x.json()).catch(() => null);
    if (!r || r.error) { setMsg("Доступ закрыт — проверь ключ."); return; }
    setChats(Array.isArray(r.chats) ? r.chats : []);
    setSpaces(Array.isArray(r.spaces) ? r.spaces : []);
    setSeedErr(r.seedError || "");
    setLoaded(true); setMsg("");
  }
  function set(i: number, patch: Partial<Chat>) { setChats((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c))); }
  async function save(c: Chat) {
    const r = await fetch(`/api/admin/chats?key=${encodeURIComponent(key)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(c) }).then((x) => x.json()).catch(() => null);
    setMsg(r?.ok ? "Сохранено ✓" : "Не сохранилось"); setTimeout(() => setMsg(""), 1500);
  }
  async function addById() {
    const id = newId.trim(); if (!id) return;
    await fetch(`/api/admin/chats?key=${encodeURIComponent(key)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chatId: id, role: "support", enabled: true }) }).catch(() => {});
    setNewId(""); await load();
  }

  const spaceOpts = (cur: string) => Array.from(new Set([...spaces, cur, "default"])).filter(Boolean).map((s) => ({ v: s, t: s }));

  return (
    <div className="admin-wrap">
      <h1 className="admin-h1">Чаты Аси — роли и настройки</h1>
      <p className="admin-sub">Чаты появляются здесь автоматически, как только Ася получает в них сообщения. Задай доминирующую роль, раздел базы знаний и параметры.</p>

      <div className="admin-row">
        <input placeholder="ADMIN_KEY" value={key} onChange={(e) => setKey(e.target.value)} className="admin-inp" style={{ width: 260 }} />
        <button onClick={load} className="admin-btn">Загрузить</button>
        <a href={`/admin/knowledge?key=${encodeURIComponent(key)}`} className="admin-btn ghost">База знаний →</a>
        {msg && <span style={{ color: "var(--accent)", alignSelf: "center" }}>{msg}</span>}
      </div>

      {seedErr && <div className="admin-err">Ошибка БД: {seedErr}</div>}

      {loaded && (
        <div className="admin-row" style={{ marginBottom: 22 }}>
          <input placeholder="Добавить чат по id (напр. -1001877817129)" value={newId} onChange={(e) => setNewId(e.target.value)} className="admin-inp" style={{ width: 340 }} />
          <button onClick={addById} className="admin-btn">Добавить</button>
        </div>
      )}

      {loaded && chats.length === 0 && <div className="admin-sub">Пока пусто. Добавь чат по id или напиши что-нибудь в чат, где есть Ася.</div>}

      {loaded && chats.map((c, i) => (
        <div key={c.chatId} className="admin-card">
          <div className="admin-card-head">
            <b>{c.title || "Без названия"}</b>
            <code className="admin-id">{c.chatId}</code>
          </div>
          <div className="admin-fields">
            <label className="admin-lbl">Роль
              <Dropdown value={c.role} options={ROLES} onChange={(v) => set(i, { role: v })} width={260} />
            </label>
            <label className="admin-lbl">Раздел базы знаний
              <Dropdown value={c.space} options={spaceOpts(c.space)} onChange={(v) => set(i, { space: v })} width={200} />
            </label>
            <label className="admin-lbl" style={{ alignSelf: "end" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}><Toggle on={c.enabled} onChange={(b) => set(i, { enabled: b })} /> включена</span>
            </label>
          </div>
          <a href={`/admin/knowledge?key=${encodeURIComponent(key)}&space=${encodeURIComponent(c.space)}`} className="admin-link">База знаний раздела «{c.space}» →</a>
          <input placeholder="Ссылка на репозиторий (GitHub) — опционально" value={c.repoUrl || ""} onChange={(e) => set(i, { repoUrl: e.target.value })} className="admin-inp" style={{ width: "100%", marginTop: 10 }} />
          <textarea placeholder="Свои правила чата (опц., переопределяют дефолтные)" value={c.rules || ""} onChange={(e) => set(i, { rules: e.target.value })} rows={3} className="admin-inp" style={{ width: "100%", marginTop: 8, resize: "vertical" }} />
          <div style={{ marginTop: 12 }}><button onClick={() => save(c)} className="admin-btn accent">Сохранить</button></div>
        </div>
      ))}
    </div>
  );
}
