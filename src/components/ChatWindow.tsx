"use client";

import { useEffect, useRef, useState } from "react";
import { Orb } from "./Orb";
import { CrisisCard } from "./CrisisCard";
import type { Contact } from "@/lib/crisis";
import { initTelegramMiniApp } from "@/lib/telegramWebApp";
import { track } from "@/lib/track";

type Msg =
  | { role: "user"; kind: "text"; content: string }
  | { role: "assistant"; kind: "text"; content: string }
  | { role: "assistant"; kind: "crisis"; content: string; contacts: Contact[] };

// Первый контакт: как обращаться (для правильного рода).
const FIRST_CHIPS = [
  { label: "Женский род", msg: "Обращайся ко мне в женском роде" },
  { label: "Мужской род", msg: "Обращайся ко мне в мужском роде" },
  { label: "Просто поболтать", msg: "Просто хочется поговорить" },
];

// Дневной лимит бесплатных сообщений (клиентский, мягкий — серверный придёт на шаге 4).
const FREE_LIMIT = 20;
function dayKey() {
  return "asya_c_" + new Date().toISOString().slice(0, 10);
}

export default function ChatWindow() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [count, setCount] = useState(0);
  const [gated, setGated] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = chatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing]);

  // Подсказка с лендинга: /chat?start=...
  useEffect(() => {
    const start = new URLSearchParams(window.location.search).get("start");
    if (start) {
      setInput(start);
      inputRef.current?.focus();
    }
  }, []);

  // Внутри Telegram — тихий вход, затем: кто вошёл + восстановление истории.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      track("chat_open", undefined, true);
      // Если открыто как Telegram Mini App — авторизуемся по Telegram до /api/me.
      const inTg = await initTelegramMiniApp();
      if (inTg) track("miniapp_open", undefined, true);
      if (cancelled) return;
      try {
        const d = await fetch("/api/me").then((r) => r.json());
        if (cancelled) return;
        const isAuthed = Boolean(d.user);
        setAuthed(isAuthed);
        if (isAuthed) {
          // Согласие на условия обязательно до сохранения переписки.
          const c = await fetch("/api/consent").then((r) => r.json()).catch(() => null);
          if (c?.needsConsent) {
            window.location.href = "/onboarding";
            return;
          }
          if (cancelled) return;
          const h = await fetch("/api/history").then((r) => r.json());
          if (cancelled) return;
          const rows: { role: string; content: string }[] = Array.isArray(h.messages) ? h.messages : [];
          if (rows.length) {
            setMessages(
              rows
                .filter((m) => (m.role === "user" || m.role === "assistant") && m.content)
                .map((m) => ({ role: m.role as "user" | "assistant", kind: "text", content: m.content })),
            );
          }
        }
      } catch {
        if (!cancelled) setAuthed(false);
      }
    })();
    try {
      setCount(Number(localStorage.getItem(dayKey()) || "0"));
    } catch {
      /* localStorage может быть недоступен */
    }
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleTheme() {
    const el = document.documentElement;
    el.dataset.theme = el.dataset.theme === "day" ? "dusk" : "day";
  }

  function updateLastAssistant(content: string) {
    setMessages((prev) => {
      const copy = [...prev];
      const last = copy[copy.length - 1];
      if (last && last.role === "assistant" && last.kind === "text") {
        copy[copy.length - 1] = { ...last, content };
      }
      return copy;
    });
  }

  function bumpCount() {
    const next = count + 1;
    setCount(next);
    try {
      localStorage.setItem(dayKey(), String(next));
    } catch {
      /* ignore */
    }
    if (authed === false && next >= FREE_LIMIT) setGated(true);
  }

  async function send(textArg?: string) {
    const text = (textArg ?? input).trim();
    if (!text || busy) return;
    if (authed === false && count >= FREE_LIMIT) {
      setGated(true);
      return;
    }
    setInput("");
    setBusy(true);

    const userMsg: Msg = { role: "user", kind: "text", content: text };
    if (messages.length === 0) track("first_message");
    track("message_sent");
    setMessages((m) => [...m, userMsg]);
    bumpCount();

    const history = [...messages, userMsg]
      .filter((m) => m.kind === "text")
      .map((m) => ({ role: m.role, content: m.content }));

    setTyping(true);
    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      const ct = resp.headers.get("content-type") || "";

      if (ct.includes("application/json")) {
        const data = await resp.json();
        setTyping(false);
        if (data.type === "crisis") {
          setMessages((m) => [...m, { role: "assistant", kind: "crisis", content: data.text, contacts: data.contacts || [] }]);
        } else if (resp.status === 429 && data.error === "limit") {
          // Дневной лимит исчерпан. Анониму — предлагаем войти (гейт), вошедшему — мягкое сообщение.
          if (data.needAuth) {
            track("gate_shown");
            setGated(true);
          }
          else setMessages((m) => [...m, { role: "assistant", kind: "text", content: data.text || "На сегодня достаточно 🤍" }]);
        } else {
          setMessages((m) => [...m, { role: "assistant", kind: "text", content: data.text || "…" }]);
        }
        return;
      }

      setTyping(false);
      setMessages((m) => [...m, { role: "assistant", kind: "text", content: "" }]);
      const reader = resp.body?.getReader();
      if (!reader) {
        updateLastAssistant("…");
        return;
      }
      const dec = new TextDecoder();
      let buf = "";
      let full = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const evt = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          for (const line of evt.split("\n")) {
            const l = line.trim();
            if (!l.startsWith("data:")) continue;
            const p = l.slice(5).trim();
            if (p === "[DONE]") continue;
            try {
              const j = JSON.parse(p);
              const d = j?.choices?.[0]?.delta?.content;
              if (d) {
                full += d;
                updateLastAssistant(full);
              }
            } catch {
              /* неполный фрагмент */
            }
          }
        }
      }
      if (!full) updateLastAssistant("…");
    } catch {
      setTyping(false);
      setMessages((m) => [...m, { role: "assistant", kind: "text", content: "Кажется, я не смогла ответить. Попробуй ещё раз чуть позже 🤍" }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <header>
        <Orb className="mini-orb" />
        <div>
          <h1>Ася</h1>
          <div className="status"><span className="dotlive" /> онлайн</div>
        </div>
        <a className="theme-btn" href="/account/settings" title="настройки" style={{ marginLeft: "auto", textDecoration: "none" }}>⚙</a>
        <button className="theme-btn" onClick={toggleTheme} title="день / вечер" style={{ marginLeft: 8 }}>◐</button>
      </header>

      <div className="chat" ref={chatRef}>
        {messages.length === 0 && (
          <div className="intro">
            <Orb className="big-orb" />
            <h2>Привет, я Ася</h2>
            <p>Чтобы говорить с тобой по-настоящему — подскажи, как к тебе обращаться: в женском роде или мужском? Спрашиваю только для этого, и это останется между нами.</p>
            <div className="starters-row intro-chips">
              {FIRST_CHIPS.map((c) => (
                <button key={c.label} className="starter" onClick={() => send(c.msg)}>{c.label}</button>
              ))}
            </div>
            <div className="safe-chip">🌸 Это общение и поддержка, не медицинская помощь</div>
          </div>
        )}

        {messages.map((m, i) =>
          m.kind === "crisis" ? (
            <div className="row assistant" key={i}>
              <Orb className="mini-orb" />
              <CrisisCard text={m.content} contacts={m.contacts} />
            </div>
          ) : (
            <div className={`row ${m.role}`} key={i}>
              {m.role === "assistant" && <Orb className="mini-orb" />}
              <div className="bubble">{m.content}</div>
            </div>
          ),
        )}

        {typing && (
          <div className="row assistant">
            <Orb className="mini-orb thinking" />
            <div className="typing"><i /><i /><i /></div>
          </div>
        )}
      </div>

      {gated ? (
        <div className="gate">
          <Orb className="gate-orb" />
          <h3>Продолжим с того же места?</h3>
          <p>Ася уже начала тебя узнавать. Войди — и она запомнит ваш разговор, чтобы в следующий раз не начинать с нуля. Это бесплатно, без карты.</p>
          <a className="btn-primary" href="/login">Войти и сохранить разговор</a>
        </div>
      ) : (
        <div className="composer">
          <div className="field">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(); }}
              placeholder="Напиши, что чувствуешь…"
              autoComplete="off"
            />
          </div>
          <button className="send" onClick={() => send()} disabled={busy} aria-label="отправить">
            <svg viewBox="0 0 24 24"><path d="M3 20.5v-6l8-2-8-2v-6l19 8z" /></svg>
          </button>
        </div>
      )}
    </div>
  );
}
