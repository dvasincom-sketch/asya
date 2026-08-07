"use client";

import { useState } from "react";

type Chat = { chatId: string; title: string | null; role: string; space: string; rules: string | null; repoUrl: string | null; enabled: boolean };

const ROLES = [
  { v: "off", t: "Выключена" },
  { v: "support", t: "Поддержка (без модерации)" },
  { v: "moderation", t: "Модерация" },
  { v: "both", t: "Модерация + поддержка" },
];

export default function ChatsAdmin() {
  const [key, setKey] = useState("");
  const [chats, setChats] = useState<Chat[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState("");
  const [seedErr, setSeedErr] = useState("");
  const [newId, setNewId] = useState("");

  async function load() {
    const r = await fetch(`/api/admin/chats?key=${encodeURIComponent(key)}`).then((x) => x.json()).catch(() => null);
    if (!r || r.error) { setMsg("Доступ закрыт — проверь ключ."); return; }
    setChats(Array.isArray(r.chats) ? r.chats : []);
    setSeedErr(r.seedError || "");
    setLoaded(true); setMsg("");
  }

  function set(i: number, patch: Partial<Chat>) {
    setChats((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  }

  async function addById() {
    const id = newId.trim();
    if (!id) return;
    await fetch(`/api/admin/chats?key=${encodeURIComponent(key)}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId: id, role: "support", enabled: true }),
    }).catch(() => {});
    setNewId("");
    await load();
  }

  async function save(c: Chat) {
    const r = await fetch(`/api/admin/chats?key=${encodeURIComponent(key)}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(c),
    }).then((x) => x.json()).catch(() => null);
    setMsg(r?.ok ? "Сохранено ✓" : "Не сохранилось");
    setTimeout(() => setMsg(""), 1500);
  }

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif", color: "#eee" }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Чаты Аси — роли и настройки</h1>
      <p style={{ color: "#aaa", fontSize: 13, marginBottom: 16 }}>Чаты появляются здесь автоматически, как только Ася получает в них сообщения. Задай доминирующую роль и параметры.</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input placeholder="ADMIN_KEY" value={key} onChange={(e) => setKey(e.target.value)} style={inp} />
        <button onClick={load} style={btn}>Загрузить</button>
        {msg && <span style={{ color: "#b79aef", alignSelf: "center" }}>{msg}</span>}
      </div>

      {seedErr && <div style={{ color: "#f7a1bc", marginBottom: 12, fontSize: 13 }}>Ошибка БД: {seedErr}</div>}

      {loaded && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input placeholder="Добавить чат по id (напр. -1001877817129)" value={newId} onChange={(e) => setNewId(e.target.value)} style={{ ...inp, width: 320 }} />
          <button onClick={addById} style={btn}>Добавить</button>
        </div>
      )}

      {loaded && chats.length === 0 && <div style={{ color: "#aaa" }}>Пока пусто. Добавь чат по id выше или напиши что-нибудь в чат, где есть Ася.</div>}

      {loaded && chats.map((c, i) => (
        <div key={c.chatId} style={{ background: "#161018", border: "1px solid #2a2230", borderRadius: 12, padding: 16, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
            <b>{c.title || "Без названия"}</b>
            <code style={{ color: "#888", fontSize: 12 }}>{c.chatId}</code>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
            <label style={lbl}>Роль
              <select value={c.role} onChange={(e) => set(i, { role: e.target.value })} style={inp}>
                {ROLES.map((r) => <option key={r.v} value={r.v}>{r.t}</option>)}
              </select>
            </label>
            <label style={lbl}>Раздел базы
              <input value={c.space} onChange={(e) => set(i, { space: e.target.value })} style={inp} />
            </label>
            <label style={{ ...lbl, flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "end" }}>
              <input type="checkbox" checked={c.enabled} onChange={(e) => set(i, { enabled: e.target.checked })} /> включена
            </label>
          </div>
          <input placeholder="Ссылка на репозиторий (GitHub) — опционально" value={c.repoUrl || ""} onChange={(e) => set(i, { repoUrl: e.target.value })} style={{ ...inp, width: "100%", marginBottom: 8 }} />
          <textarea placeholder="Свои правила чата (опц., переопределяют дефолтные)" value={c.rules || ""} onChange={(e) => set(i, { rules: e.target.value })} rows={3} style={{ ...inp, width: "100%", resize: "vertical" }} />
          <div style={{ marginTop: 10 }}><button onClick={() => save(c)} style={btnAccent}>Сохранить</button></div>
        </div>
      ))}
    </div>
  );
}

const inp: React.CSSProperties = { background: "#0f0b13", border: "1px solid #333", borderRadius: 8, padding: "8px 11px", color: "#eee", fontSize: 14 };
const btn: React.CSSProperties = { background: "#241733", border: "1px solid #444", borderRadius: 8, padding: "8px 14px", color: "#eee", cursor: "pointer", fontSize: 14 };
const btnAccent: React.CSSProperties = { ...btn, background: "#b79aef", color: "#1a1020", border: "none", fontWeight: 600 };
const lbl: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#aaa" };
