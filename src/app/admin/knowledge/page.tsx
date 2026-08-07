"use client";

import { useEffect, useState } from "react";

type Article = { id: string; space: string; title: string; body: string; updatedAt?: string };

export default function KnowledgeAdmin() {
  const [key, setKey] = useState("");
  const [space, setSpace] = useState("default");
  const [articles, setArticles] = useState<Article[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [edit, setEdit] = useState<{ id?: string; title: string; body: string }>({ title: "", body: "" });
  const [msg, setMsg] = useState("");

  // Автозагрузка по ссылке из раздела управления чатами: /admin/knowledge?key=...&space=...
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const k = q.get("key") || "";
    const s = q.get("space") || "default";
    if (k) setKey(k);
    if (s) setSpace(s);
    if (k) load(k, s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load(k = key, s = space) {
    const r = await fetch(`/api/admin/knowledge?key=${encodeURIComponent(k)}&space=${encodeURIComponent(s)}`).then((x) => x.json()).catch(() => null);
    if (!r || r.error) { setMsg("Доступ закрыт — проверь ключ."); return; }
    setArticles(Array.isArray(r.articles) ? r.articles : []);
    setLoaded(true);
    setMsg("");
  }

  async function save() {
    if (!edit.title.trim() || !edit.body.trim()) { setMsg("Заголовок и текст обязательны."); return; }
    const r = await fetch(`/api/admin/knowledge?key=${encodeURIComponent(key)}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: edit.id, space, title: edit.title, body: edit.body }),
    }).then((x) => x.json()).catch(() => null);
    if (!r?.ok) { setMsg("Не сохранилось."); return; }
    setEdit({ title: "", body: "" });
    await load();
  }

  async function del(id: string) {
    await fetch(`/api/admin/knowledge?key=${encodeURIComponent(key)}&id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
    await load();
  }

  return (
    <div className="admin-wrap">
      <a href={`/admin/chats?key=${encodeURIComponent(key)}`} className="admin-back">← К управлению чатами</a>
      <h1 className="admin-h1">База знаний Аси — раздел «{space}»</h1>
      <p className="admin-sub">Закрытый раздел управления чатами. Ася отвечает участникам строго по этим статьям — своими словами, но только по фактам отсюда. Каждый чат ссылается на свой раздел (space).</p>

      <div className="admin-row">
        <input placeholder="ADMIN_KEY" value={key} onChange={(e) => setKey(e.target.value)} className="admin-inp" style={{ width: 240 }} />
        <input placeholder="раздел (space)" value={space} onChange={(e) => setSpace(e.target.value)} className="admin-inp" style={{ width: 180 }} />
        <button onClick={() => load()} className="admin-btn">Загрузить</button>
      </div>
      {msg && <div style={{ color: "var(--accent)", marginBottom: 12 }}>{msg}</div>}

      {loaded && (
        <>
          <div className="admin-card">
            <div style={{ fontWeight: 600, marginBottom: 12 }}>{edit.id ? "Редактировать статью" : "Новая статья"}</div>
            <input placeholder="Заголовок (напр. Как загрузить видео в Студии)" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} className="admin-inp" style={{ width: "100%", marginBottom: 10 }} />
            <textarea placeholder="Текст ответа / инструкция" value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} rows={7} className="admin-inp" style={{ width: "100%", resize: "vertical" }} />
            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <button onClick={save} className="admin-btn accent">{edit.id ? "Сохранить" : "Добавить"}</button>
              {edit.id && <button onClick={() => setEdit({ title: "", body: "" })} className="admin-btn ghost">Отмена</button>}
            </div>
          </div>

          <div className="admin-sub" style={{ marginBottom: 10 }}>Статьи в разделе «{space}»: {articles.length}</div>
          {articles.length === 0 && <div className="admin-hint">Пока пусто. Добавь первую статью — Ася сразу начнёт отвечать по ней.</div>}
          {articles.map((a) => (
            <div key={a.id} className="admin-card" style={{ padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                <b style={{ fontSize: 15.5 }}>{a.title}</b>
                <span style={{ display: "flex", gap: 8, flex: "0 0 auto" }}>
                  <button onClick={() => setEdit({ id: a.id, title: a.title, body: a.body })} className="admin-btn ghost" style={{ padding: "5px 12px", fontSize: 12.5 }}>ред.</button>
                  <button onClick={() => del(a.id)} className="admin-btn ghost" style={{ padding: "5px 12px", fontSize: 12.5, color: "var(--bubble-u1)" }}>удалить</button>
                </span>
              </div>
              <div style={{ color: "var(--text-soft)", fontSize: 13.5, marginTop: 8, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{a.body.slice(0, 400)}{a.body.length > 400 ? "…" : ""}</div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
