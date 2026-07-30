"use client";

import { useEffect, useRef, useState } from "react";
import { Orb } from "./Orb";
import { track } from "@/lib/track";
import { clean } from "@/lib/text";

type Tpl = { id: string; title: string; icon: string; group: "self" | "goal"; blurb: string; badge?: string; steps: number };
type Saved = {
  id: string; template: string; title: string; icon: string; saveTo: string;
  synthType: "points" | "canvas"; summary: string; createdAt: string;
};
type Turn = { role: "assistant" | "user"; content: string };
type Synth = { summary: string; synthType: "points" | "canvas"; synthTitle: string; synthSub: string; saveTo: string };

function toggleTheme() {
  const el = document.documentElement;
  el.dataset.theme = el.dataset.theme === "day" ? "dusk" : "day";
}

// Итог приходит как JSON: список наблюдений или пары «ключ — значение».
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

export default function SessionsScreen() {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(true);
  const [templates, setTemplates] = useState<Tpl[]>([]);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [openSaved, setOpenSaved] = useState<Saved | null>(null);

  // Живая сессия.
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ title: string; topic: string; labels: string[]; total: number } | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [step, setStep] = useState(1);
  const [ready, setReady] = useState(false); // все вопросы заданы — пора подводить итог
  const [synth, setSynth] = useState<Synth | null>(null);
  const [savedDone, setSavedDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const d = await fetch("/api/session").then((r) => r.json());
      setAuthed(Boolean(d.user));
      setTemplates(Array.isArray(d.templates) ? d.templates : []);
      setSaved(Array.isArray(d.saved) ? d.saved : []);
    } catch {
      setError("Не удалось загрузить разборы.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, synth, busy]);

  async function post(payload: Record<string, unknown>) {
    const r = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  }

  async function start(id: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const d = await post({ action: "start", template: id });
      track("session_start", id);
      setSessionId(d.sessionId);
      setMeta({ title: d.title, topic: d.topic, labels: d.labels, total: d.total });
      setTurns([{ role: "assistant", content: d.question }]);
      setStep(d.step);
      setReady(false);
      setSynth(null);
      setSavedDone(false);
    } catch {
      setError("Не получилось начать разбор. Попробуй ещё раз.");
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || busy || !sessionId) return;
    setInput("");
    setTurns((v) => [...v, { role: "user", content: text }]);
    setBusy(true);
    setError("");
    try {
      const d = await post({ action: "reply", sessionId, text });
      if (d.ready) setReady(true);
      else {
        setTurns((v) => [...v, { role: "assistant", content: d.question }]);
        setStep(d.step);
      }
    } catch {
      setError("Ася не ответила. Попробуй ещё раз.");
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    if (busy || !sessionId) return;
    setBusy(true);
    setError("");
    try {
      const d = await post({ action: "finish", sessionId });
      setSynth(d);
    } catch {
      setError("Не получилось собрать итог. Попробуй ещё раз.");
    } finally {
      setBusy(false);
    }
  }

  async function saveSynth() {
    if (busy || !sessionId) return;
    setBusy(true);
    try {
      await post({ action: "save", sessionId });
      track("session_saved");
      setSavedDone(true);
      load();
    } catch {
      setError("Не получилось сохранить.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setSessionId(null);
    setMeta(null);
    setTurns([]);
    setSynth(null);
    setReady(false);
    setSavedDone(false);
    setInput("");
    setError("");
  }

  // ---------- Просмотр сохранённого разбора ----------
  if (openSaved) {
    const { points, pairs } = parseSummary(openSaved.summary);
    return (
      <div className="app">
        <div className="sbar">
          <button className="icobtn" onClick={() => setOpenSaved(null)} title="назад">‹</button>
          <h1>{openSaved.title}</h1>
          <button className="icobtn right" onClick={toggleTheme}>◐</button>
        </div>
        <div className="sbody">
          <div className="synth">
            <h3>{openSaved.title}</h3>
            <div className="s-sub">
              {openSaved.saveTo} · {new Date(openSaved.createdAt).toLocaleDateString("ru-RU")}
            </div>
            {pairs.length
              ? pairs.map(([k, v]) => (<div className="kv" key={k}><div className="k">{k}</div><div className="v">{v}</div></div>))
              : points.map((p, i) => (<div className="pt" key={i}><span>{p}</span></div>))}
          </div>
        </div>
      </div>
    );
  }

  // ---------- Экран выбора ----------
  if (!sessionId || !meta) {
    const self = templates.filter((t) => t.group === "self");
    const goal = templates.filter((t) => t.group === "goal");
    return (
      <div className="app">
        <div className="sbar">
          <a className="icobtn" href="/account" title="назад">‹</a>
          <h1>Сессия с Асей</h1>
          <button className="icobtn right" onClick={toggleTheme}>◐</button>
        </div>
        <div className="sbody" ref={bodyRef}>
          <div className="setup-intro">
            <Orb className="s-orb" />
            <h2>Над чем поработаем?</h2>
            <p>Ася может просто выслушать — а может провести по шагам, как коуч. Методики внутри, а разговор живой.</p>
          </div>

          {!authed && (
            <div className="gate" style={{ margin: "0 0 18px" }}>
              <h3>Чтобы вести разборы, войди</h3>
              <p>Так Ася сохранит ваши сессии и итоги — и ты найдёшь их здесь потом. Это бесплатно.</p>
              <a className="btn-primary" href="/login">Войти</a>
            </div>
          )}

          {error && <div className="auth-error">{error}</div>}

          {loading ? (
            <div className="grp">Загружаю…</div>
          ) : (
            <>
              <div className="grp">Разобраться в себе</div>
              {self.map((t) => (
                <button key={t.id} className="opt" onClick={() => start(t.id)} disabled={busy || !authed}>
                  <div className="o-ic">{t.icon}</div>
                  <div>
                    <b>{t.title}</b>
                    <span>{t.blurb}</span>
                    {t.badge && <span className="badge">{t.badge}</span>}
                  </div>
                </button>
              ))}
              <div className="grp">Двигаться к цели</div>
              {goal.map((t) => (
                <button key={t.id} className="opt" onClick={() => start(t.id)} disabled={busy || !authed}>
                  <div className="o-ic">{t.icon}</div>
                  <div>
                    <b>{t.title}</b>
                    <span>{t.blurb}</span>
                    {t.badge && <span className="badge">{t.badge}</span>}
                  </div>
                </button>
              ))}

              <div className="grp">Сохранённые разборы</div>
              {saved.length === 0 ? (
                <div className="setup-intro" style={{ padding: "10px 4px 0" }}>
                  <p>Здесь появятся твои разборы — итог каждой сессии, чтобы можно было вернуться.</p>
                </div>
              ) : (
                saved.map((s) => (
                  <button key={s.id} className="opt" onClick={() => setOpenSaved(s)}>
                    <div className="o-ic">{s.icon}</div>
                    <div>
                      <b>{s.title}</b>
                      <span>
                        {s.saveTo} · {new Date(s.createdAt).toLocaleDateString("ru-RU")}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // ---------- Живая сессия ----------
  const currentIdx = synth ? meta.labels.length - 1 : Math.min(step - 1, meta.labels.length - 1);

  return (
    <div className="app">
      <div className="sbar">
        <button className="icobtn" onClick={reset} title="назад">‹</button>
        <h1>{meta.title}</h1>
        <button className="icobtn right" onClick={toggleTheme}>◐</button>
      </div>

      <div className="banner">
        <div className="sb-topic">{meta.topic}</div>
        <div className="stepper">
          {meta.labels.map((_, i) => (
            <i key={i} className={i < currentIdx ? "done" : i === currentIdx ? "now" : ""} />
          ))}
        </div>
        <div className="sb-step">
          <b>{meta.labels[currentIdx]}</b> · шаг {currentIdx + 1} из {meta.labels.length}
        </div>
      </div>

      <div className="sbody" ref={bodyRef}>
        {turns.map((m, i) => (
          <div className={`row ${m.role}`} key={i}>
            {m.role === "assistant" && <Orb className="mini-orb" />}
            <div className="bubble">{m.role === "assistant" ? clean(m.content) : m.content}</div>
          </div>
        ))}

        {busy && !synth && (
          <div className="row assistant">
            <Orb className="mini-orb thinking" />
            <div className="typing"><i /><i /><i /></div>
          </div>
        )}

        {synth && (
          <>
            <div className="phase-tag">Итог</div>
            <div className="synth">
              <h3>{synth.synthTitle}</h3>
              <div className="s-sub">{synth.synthSub}</div>
              {(() => {
                const { points, pairs } = parseSummary(synth.summary);
                if (pairs.length) return pairs.map(([k, v]) => (<div className="kv" key={k}><div className="k">{k}</div><div className="v">{v}</div></div>));
                if (points.length) return points.map((p, i) => (<div className="pt" key={i}><span>{p}</span></div>));
                return <div className="pt"><span>Здесь пока пусто — расскажи чуть больше, и Ася соберёт итог.</span></div>;
              })()}
              <div className="save">
                <button className="primary" disabled={savedDone || busy} onClick={saveSynth}>
                  {savedDone ? `Сохранено в «${synth.saveTo}» 🤍` : `Сохранить в тему «${synth.saveTo}»`}
                </button>
                <button className="ghost" onClick={reset}>Спасибо, Ася</button>
              </div>
            </div>
          </>
        )}

        {error && <div className="auth-error">{error}</div>}
      </div>

      {!synth &&
        (ready ? (
          <div className="foot-btn">
            <button className="btn-primary" onClick={finish} disabled={busy}>
              {busy ? <span className="spinner" /> : "Подвести итог"}
            </button>
          </div>
        ) : (
          <div className="composer">
            <div className="field">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") send(); }}
                placeholder="Ответь своими словами…"
                autoComplete="off"
                disabled={busy}
              />
            </div>
            <button className="send" onClick={send} disabled={busy || !input.trim()} aria-label="отправить">
              <svg viewBox="0 0 24 24"><path d="M3 20.5v-6l8-2-8-2v-6l19 8z" /></svg>
            </button>
          </div>
        ))}
    </div>
  );
}
