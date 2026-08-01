"use client";

import { useEffect, useState } from "react";
import { Orb } from "./Orb";
import { clean, trim } from "@/lib/text";
import { PROFILE_FORMS, type ProfileForm } from "@/lib/profileForms";

type Theme = { name: string; icon: string; line: string; count: number; updatedAt: string; big?: boolean };
type SavedItem = { id: string; title: string; icon: string; synthType: "points" | "canvas"; summary: string; date: string };
type Detail = {
  topic: string; icon: string; count: number; summary: string;
  insights: string[]; saved: SavedItem[]; moments: { date: string; text: string }[];
};

function toggleTheme() {
  const el = document.documentElement;
  el.dataset.theme = el.dataset.theme === "day" ? "dusk" : "day";
}

// «3 дня назад» / «сегодня» — по-человечески.
function ago(iso: string): string {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return "сегодня";
  if (days === 1) return "вчера";
  if (days < 7) return `${days} дня назад`;
  if (days < 30) return `${Math.floor(days / 7)} нед. назад`;
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

function parseSummary(raw: string): { points: string[]; pairs: [string, string][] } {
  try {
    const p: unknown = JSON.parse(raw);
    if (!Array.isArray(p)) return { points: [], pairs: [] };
    if (p.length && Array.isArray(p[0])) {
      return { points: [], pairs: p.map((x) => [clean(String((x as unknown[])[0])), clean(String((x as unknown[])[1]))]) };
    }
    return { points: p.map((x) => clean(String(x))), pairs: [] };
  } catch {
    return { points: [], pairs: [] };
  }
}

function SavedCard({ s }: { s: SavedItem }) {
  const { points, pairs } = parseSummary(s.summary);
  return (
    <div className="saved-card">
      <div className="sv-head">
        <span className="sv-ic">{s.icon}</span>
        <div><b>{s.title}</b><span>сохранено {ago(s.date)} · из сессии</span></div>
      </div>
      {pairs.length
        ? pairs.map(([k, v]) => (<div className="kv" key={k}><div className="k">{k}</div><div className="v">{v}</div></div>))
        : points.map((p, i) => (<div className="pt" key={i}><span>{p}</span></div>))}
    </div>
  );
}

export default function MemoryScreen() {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(true);
  const [portrait, setPortrait] = useState("");
  const [themes, setThemes] = useState<Theme[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [answers, setAnswers] = useState<Record<string, Record<string, string>>>({});
  const [activeForm, setActiveForm] = useState<ProfileForm | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    fetch("/api/knowledge")
      .then((r) => r.json())
      .then((d) => {
        setAuthed(Boolean(d.user));
        setPortrait(d.portrait || "");
        setThemes(Array.isArray(d.themes) ? d.themes : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => setAnswers(d.answers || {}))
      .catch(() => {});
  }, []);

  async function open(topic: string) {
    setDetailLoading(true);
    try {
      const d = await fetch(`/api/knowledge/theme?topic=${encodeURIComponent(topic)}`).then((r) => r.json());
      if (!d.error) setDetail(d);
    } catch {
      /* ignore */
    } finally {
      setDetailLoading(false);
    }
  }

  function openForm(f: ProfileForm) {
    setDraft({ ...(answers[f.id] || {}) });
    setActiveForm(f);
  }
  function filledCount(formId: string): number {
    const a = answers[formId] || {};
    return Object.values(a).filter((v) => (v || "").trim()).length;
  }
  async function saveProfile() {
    if (!activeForm || savingProfile) return;
    setSavingProfile(true);
    try {
      await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formId: activeForm.id, answers: draft }),
      });
      setAnswers((a) => ({ ...a, [activeForm.id]: { ...draft } }));
      setActiveForm(null);
    } catch {
      /* ignore */
    } finally {
      setSavingProfile(false);
    }
  }

  // ---------- Заполнение грани профиля ----------
  if (activeForm) {
    const seed = `Хочу рассказать тебе о себе — про: ${activeForm.title.toLowerCase()}`;
    return (
      <div className="app">
        <div className="sbar">
          <button className="icobtn" onClick={() => setActiveForm(null)} title="назад">‹</button>
          <h1>{activeForm.title}</h1>
          <button className="icobtn right" onClick={toggleTheme}>◐</button>
        </div>
        <div className="sbody">
          <div className="d-head">
            <div className="d-ic">{activeForm.icon}</div>
            <div>
              <h2>{activeForm.title}</h2>
              <div className="d-sub">{activeForm.blurb}</div>
            </div>
          </div>

          {activeForm.questions.map((q) => (
            <div key={q.id}>
              <div className="q-label">{q.label}</div>
              <textarea
                className="profile-input"
                value={draft[q.id] || ""}
                placeholder={q.placeholder}
                onChange={(e) => setDraft((d) => ({ ...d, [q.id]: e.target.value }))}
                rows={2}
              />
            </div>
          ))}

          <button className="btn-primary" onClick={saveProfile} disabled={savingProfile} style={{ marginTop: 18 }}>
            {savingProfile ? <span className="spinner" /> : "Сохранить"}
          </button>
          <a className="btn-ghost" href={`/chat?start=${encodeURIComponent(seed)}`}>Обсудить с Асей</a>
          <div className="hnote">
            Можно заполнить не всё и вернуться позже — что напишешь, то Ася и учтёт. Убрать сказанное можно здесь же или
            в настройках.
          </div>
        </div>
      </div>
    );
  }

  // ---------- Детали темы ----------
  if (detail) {
    return (
      <div className="app">
        <div className="sbar">
          <button className="icobtn" onClick={() => setDetail(null)} title="назад">‹</button>
          <h1>{detail.topic}</h1>
          <button className="icobtn right" onClick={toggleTheme}>◐</button>
        </div>
        <div className="sbody">
          <div className="d-head">
            <div className="d-ic">{detail.icon}</div>
            <div>
              <h2>{detail.topic}</h2>
              <div className="d-sub">
                {detail.count} {detail.count === 1 ? "запись" : "записей"} в памяти
              </div>
            </div>
          </div>

          {detail.summary && (
            <>
              <div className="sec">Что я понимаю</div>
              <div className="d-summary">{trim(detail.summary, 600)}</div>
            </>
          )}

          {detail.insights.length > 0 && (
            <>
              <div className="sec" style={{ marginTop: detail.summary ? 24 : 0 }}>Что я помню</div>
              {detail.insights.map((i, idx) => (<div className="insight" key={idx}><span>{clean(i)}</span></div>))}
            </>
          )}

          {detail.saved.length > 0 && (
            <>
              <div className="sec" style={{ marginTop: 24 }}>Сохранённые разборы</div>
              {detail.saved.map((s) => (<SavedCard s={s} key={s.id} />))}
            </>
          )}

          {detail.moments.length > 0 && (
            <>
              <div className="sec" style={{ marginTop: 24 }}>Моменты</div>
              <div className="tl">
                {detail.moments.map((m, i) => (
                  <div className="moment" key={i}>
                    <div className="m-date">{ago(m.date)}</div>
                    <div className="m-text">{clean(m.text)}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          <a className="btn-primary" href="/chat" style={{ marginTop: 22 }}>Поговорить об этом</a>
        </div>
      </div>
    );
  }

  // ---------- Обзор ----------
  return (
    <div className="app">
      <div className="sbar">
        <a className="icobtn" href="/account" title="назад">‹</a>
        <h1>То, что я о тебе знаю</h1>
        <button className="icobtn right" onClick={toggleTheme}>◐</button>
      </div>
      <div className="sbody">
        {!authed ? (
          <div className="gate" style={{ marginTop: 8 }}>
            <Orb className="gate-orb" />
            <h3>Здесь будет то, что Ася о тебе знает</h3>
            <p>Войди — и она начнёт бережно запоминать, что тебе важно, и раскладывать это по темам. Бесплатно.</p>
            <a className="btn-primary" href="/login">Войти</a>
          </div>
        ) : (
          <>
            <div className="portrait">
              <Orb className="p-orb" />
              <div>
                <h2>Как я тебя вижу</h2>
                <p>
                  {loading
                    ? "Собираю…"
                    : trim(portrait, 500) ||
                      "Мы ещё только знакомимся — поговори со мной, и здесь появится то, что я о тебе понимаю 🤍"}
                </p>
              </div>
            </div>

            {themes.length > 0 ? (
              <>
                <div className="sec">
                  Твои темы <small>Ася сама раскладывает разговоры по темам — тебе не нужно ничего сортировать</small>
                </div>
                <div className="themes">
                  {themes.map((th) => (
                    <button
                      className={`theme ${th.big ? "big" : ""}`}
                      key={th.name}
                      onClick={() => open(th.name)}
                      disabled={detailLoading}
                    >
                      <div className="t-ic">{th.icon}</div>
                      <div className="t-body">
                        <h3>{th.name}</h3>
                        <div className="t-line">{th.line}</div>
                        <div className="t-meta">
                          {th.count} {th.count === 1 ? "запись" : "записей"} · обновлено {ago(th.updatedAt)}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              !loading && (
                <div className="setup-intro" style={{ marginTop: 18 }}>
                  <h2>Пока пусто</h2>
                  <p>
                    Расскажи мне о себе в разговоре — я запомню то, что тебе важно, и сама разложу по темам. Здесь можно
                    будет всё посмотреть, а в настройках — что угодно убрать.
                  </p>
                  <a className="btn-primary" href="/chat" style={{ marginTop: 16 }}>Поговорить</a>
                </div>
              )
            )}

            <div className="sec" style={{ marginTop: 24 }}>
              Рассказать о себе <small>Заполни, что хочешь — Ася учтёт это в разговоре. Можно и просто обсудить с ней.</small>
            </div>
            <div className="themes">
              {PROFILE_FORMS.map((f) => {
                const n = filledCount(f.id);
                return (
                  <button className="theme" key={f.id} onClick={() => openForm(f)}>
                    <div className="t-ic">{f.icon}</div>
                    <div className="t-body">
                      <h3>{f.title}</h3>
                      <div className="t-line">{f.blurb}</div>
                      <div className="t-meta">
                        {n > 0 ? `заполнено ${n} из ${f.questions.length}` : "рассказать"}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
