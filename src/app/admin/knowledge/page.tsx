"use client";

import { useState } from "react";

type Article = { id: string; space: string; title: string; body: string; updatedAt?: string };

export default function KnowledgeAdmin() {
  const [key, setKey] = useState("");
  const [space, setSpace] = useState("default");
  const [articles, setArticles] = useState<Article[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [edit, setEdit] = useState<{ id?: string; title: string; body: string }>({ title: "", body: "" });
  const [msg, setMsg] = useState("");

  async function load() {
    const r = await fetch(`/api/admin/knowledge?key=${encodeURIComponent(key)}&space=${encodeURIComponent(space)}`).then((x) => x.json()).catch(() => null);
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
    <div style={{ maxWidth: 820, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif", color: "#eee" }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>База знаний Аси — поддержка</h1>
      <p style={{ color: "#aaa", fontSize: 13, marginBottom: 16 }}>Закрытый раздел. Ася отвечает участникам строго по этим статьям.</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input placeholder="ADMIN_KEY" value={key} onChange={(e) => setKey(e.target.value)} style={inp} />
        <input placeholder="раздел (напр. studio)" value={space} onChange={(e) => setSpace(e.target.value)} style={inp} />
        <button onClick={load} style={btn}>Загрузить</button>
      </div>
      {msg && <div style={{ color: "#f7a1bc", marginBottom: 12 }}>{msg}</div>}

      {loaded && (
        <>
          <div style={{ background: "#1b1420", border: "1px solid #333", borderRadius: 12, padding: 16, marginBottom: 20 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>{edit.id ? "Редактировать статью" : "Новая статья"}</div>
            <input placeholder="Заголовок (напр. Как загрузить видео в Студии)" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} style={{ ...inp, width: "100%", marginBottom: 8 }} />
            <textarea placeholder="Текст ответа / инструкция" value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} rows={7} style={{ ...inp, width: "100%", resize: "vertical" }} />
            <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
              <button onClick={save} style={btnAccent}>{edit.id ? "Сохранить" : "Добавить"}</button>
              {edit.id && <button onClick={() => setEdit({ title: "", body: "" })} style={btn}>Отмена</button>}
            </div>
          </div>

          <div style={{ color: "#aaa", fontSize: 13, marginBottom: 8 }}>Статьи в разделе «{space}»: {articles.length}</div>
          {articles.map((a) => (
            <div key={a.id} style={{ background: "#161018", border: "1px solid #2a2230", borderRadius: 12, padding: 14, marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <b>{a.title}</b>
                <span style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setEdit({ id: a.id, title: a.title, body: a.body })} style={btnSm}>ред.</button>
                  <button onClick={() => del(a.id)} style={btnSmDanger}>удалить</button>
                </span>
              </div>
              <div style={{ color: "#bbb", fontSize: 13, marginTop: 6, whiteSpace: "pre-wrap" }}>{a.body.slice(0, 400)}{a.body.length > 400 ? "…" : ""}</div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

const inp: React.CSSProperties = { background: "#0f0b13", border: "1px solid #333", borderRadius: 8, padding: "9px 12px", color: "#eee", fontSize: 14 };
const btn: React.CSSProperties = { background: "#241733", border: "1px solid #444", borderRadius: 8, padding: "9px 14px", color: "#eee", cursor: "pointer", fontSize: 14 };
const btnAccent: React.CSSProperties = { ...btn, background: "#b79aef", color: "#1a1020", border: "none", fontWeight: 600 };
const btnSm: React.CSSProperties = { ...btn, padding: "4px 10px", fontSize: 12 };
const btnSmDanger: React.CSSProperties = { ...btnSm, color: "#f7a1bc" };
