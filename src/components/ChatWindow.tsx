"use client";

import { useEffect, useRef, useState } from "react";
import { Orb } from "./Orb";
import { CrisisCard } from "./CrisisCard";
import type { Contact } from "@/lib/crisis";

type Msg =
  | { role: "user"; kind: "text"; content: string }
  | { role: "assistant"; kind: "text"; content: string }
  | { role: "assistant"; kind: "crisis"; content: string; contacts: Contact[] };

export default function ChatWindow() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = chatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing]);

  // Подсказка с лендинга: /chat?start=... — подставляем в поле и фокусируем.
  useEffect(() => {
    const start = new URLSearchParams(window.location.search).get("start");
    if (start) {
      setInput(start);
      inputRef.current?.focus();
    }
  }, []);

  function toggleTheme() {
    const el = document.documentElement;
    el.dataset.theme = el.dataset.theme === "day" ? "dusk" : "day";
  }

  // Обновляет content последнего сообщения-ассистента (для стрима).
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

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);

    const userMsg: Msg = { role: "user", kind: "text", content: text };
    setMessages((m) => [...m, userMsg]);

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
          setMessages((m) => [
            ...m,
            { role: "assistant", kind: "crisis", content: data.text, contacts: data.contacts || [] },
          ]);
        } else {
          setMessages((m) => [...m, { role: "assistant", kind: "text", content: data.text || "…" }]);
        }
        return;
      }

      // Стрим ответа модели (SSE).
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
              /* пропускаем неполные фрагменты */
            }
          }
        }
      }
      if (!full) updateLastAssistant("…");
    } catch {
      setTyping(false);
      setMessages((m) => [
        ...m,
        { role: "assistant", kind: "text", content: "Кажется, я не смогла ответить. Попробуй ещё раз чуть позже 🤍" },
      ]);
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
          <div className="status">
            <span className="dotlive" /> рядом, слушает
          </div>
        </div>
        <a className="theme-btn" href="/account/settings" title="настройки" style={{ marginLeft: "auto", textDecoration: "none" }}>
          ⚙
        </a>
        <button className="theme-btn" onClick={toggleTheme} title="день / вечер" style={{ marginLeft: 8 }}>
          ◐
        </button>
      </header>

      <div className="chat" ref={chatRef}>
        {messages.length === 0 && (
          <div className="intro">
            <Orb className="big-orb" />
            <h2>Привет, я Ася</h2>
            <p>Здесь можно просто поговорить — о чём угодно. Тебя тут не торопят и не осудят.</p>
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
            <div className="typing">
              <i />
              <i />
              <i />
            </div>
          </div>
        )}
      </div>

      <div className="composer">
        <div className="field">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
            placeholder="Напиши, что чувствуешь…"
            autoComplete="off"
          />
        </div>
        <button className="send" onClick={send} disabled={busy} aria-label="отправить">
          <svg viewBox="0 0 24 24">
            <path d="M3 20.5v-6l8-2-8-2v-6l19 8z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
