"use client";

import { useEffect, useState } from "react";

type Article = { id: string; space: string; title: string; body: string; source?: string | null; updatedAt?: string };

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

export default function KnowledgeAdmin() {
  const [key, setKey] = useState("");
  const [space, setSpace] = useState(""); // "" = все разделы
  const [spaces, setSpaces] = useState<string[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [edit, setEdit] = useState<{ id?: string; space: string; title: string; body: string }>({ space: "default", title: "", body: "" });
  const [msg, setMsg] = useState("");

  // Из карточки чата приходим с ?key=&space=; без space — показываем все разделы.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const k = q.get("key") || "";
    const s = q.get("space") || "";
    if (k) setKey(k);
    setSpace(s);
    if (s) setEdit((e) => ({ ...e, space: s }));
    if (k) load(k, s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load(k = key, s = space) {
    const qs = s ? `&space=${encodeURIComponent(s)}` : "";
    const r = await fetch(`/api/admin/knowledge?key=${encodeURIComponent(k)}${qs}`).then((x) => x.json()).catch(() => null);
    if (!r || r.error) { setMsg("Доступ закрыт — проверь ключ."); return; }
    setArticles(Array.isArray(r.articles) ? r.articles : []);
    setSpaces(Array.isArray(r.spaces) ? r.spaces : []);
    setLoaded(true);
    setMsg("");
  }

  function pickSpace(s: string) {
    setSpace(s);
    setEdit((e) => ({ ...e, space: s || e.space || "default" }));
    load(key, s);
  }

  async function save() {
    if (!edit.title.trim() || !edit.body.trim()) { setMsg("Заголовок и текст обязательны."); return; }
    const r = await fetch(`/api/admin/knowledge?key=${encodeURIComponent(key)}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: edit.id, space: edit.space || "default", title: edit.title, body: edit.body }),
    }).then((x) => x.json()).catch(() => null);
    if (!r?.ok) { setMsg("Не сохранилось."); return; }
    setEdit({ space: edit.space || "default", title: "", body: "" });
    await load();
  }

  async function del(id: string) {
    await fetch(`/api/admin/knowledge?key=${encodeURIComponent(key)}&id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
    await load();
  }

  const viewOpts = [{ v: "", t: "Все разделы" }, ...spaces.map((s) => ({ v: s, t: s }))];
  const editOpts = Array.from(new Set([...spaces, edit.space, "default"])).filter(Boolean).map((s) => ({ v: s, t: s }));

  return (
    <div className="admin-wrap">
      <a href={`/admin/chats?key=${encodeURIComponent(key)}`} className="admin-back">← К управлению чатами</a>
      <h1 className="admin-h1">База знаний Аси</h1>
      <p className="admin-sub">Закрытый раздел управления чатами. Ася отвечает участникам строго по этим статьям — своими словами, но только по фактам отсюда. Каждый чат ссылается на свой раздел (space); здесь можно смотреть все разделы сразу или конкретный.</p>

      <div className="admin-row">
        <input placeholder="ADMIN_KEY" value={key} onChange={(e) => setKey(e.target.value)} className="admin-inp" style={{ width: 240 }} />
        <button onClick={() => load()} className="admin-btn">Загрузить</button>
      </div>
      {msg && <div style={{ color: "var(--accent)", marginBottom: 12 }}>{msg}</div>}

      {loaded && (
        <>
          <div className="admin-row" style={{ alignItems: "flex-end" }}>
            <label className="admin-lbl">Показать раздел
              <Dropdown value={space} options={viewOpts} onChange={pickSpace} width={240} />
            </label>
            <span className="admin-hint" style={{ marginTop: 0, alignSelf: "center" }}>Статей: {articles.length}{spaces.length ? ` · разделов: ${spaces.length}` : ""}</span>
          </div>

          <div className="admin-card">
            <div style={{ fontWeight: 600, marginBottom: 12 }}>{edit.id ? "Редактировать статью" : "Новая статья"}</div>
            <label className="admin-lbl" style={{ marginBottom: 10 }}>Раздел статьи
              <Dropdown value={edit.space} options={editOpts} onChange={(v) => setEdit({ ...edit, space: v })} width={220} />
            </label>
            <input placeholder="Заголовок (напр. Как загрузить видео в Студии)" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} className="admin-inp" style={{ width: "100%", marginBottom: 10 }} />
            <textarea placeholder="Текст ответа / инструкция" value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} rows={7} className="admin-inp" style={{ width: "100%", resize: "vertical" }} />
            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <button onClick={save} className="admin-btn accent">{edit.id ? "Сохранить" : "Добавить"}</button>
              {edit.id && <button onClick={() => setEdit({ space: edit.space, title: "", body: "" })} className="admin-btn ghost">Отмена</button>}
            </div>
          </div>

          {articles.length === 0 && <div className="admin-hint">Пока пусто. Добавь первую статью — Ася сразу начнёт отвечать по ней.</div>}
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
        </>
      )}
    </div>
  );
}
