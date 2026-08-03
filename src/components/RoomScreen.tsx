"use client";

import { useEffect, useRef, useState } from "react";
import { Orb } from "./Orb";

type Msg = { id: string; mine: boolean; sender: string; kind: string; content: string; at?: string };

export default function RoomScreen({ roomId }: { roomId: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [asyaPresent, setAsyaPresent] = useState(true);
  const [iVoted, setIVoted] = useState(false);
  const [otherVoted, setOtherVoted] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [booted, setBooted] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function toast(m: string) {
    setToastMsg(m);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(""), 2800);
  }
  function toggleTheme() {
    const el = document.documentElement;
    el.dataset.theme = el.dataset.theme === "day" ? "dusk" : "day";
  }

  async function load() {
    const d = await fetch(`/api/network/rooms/${roomId}`).then((r) => r.json()).catch(() => null);
    if (!d || d.error) {
      setBooted(true);
      return;
    }
    setAsyaPresent(Boolean(d.asyaPresent));
    setIVoted(Boolean(d.iVotedRemove));
    setOtherVoted(Boolean(d.otherVotedRemove));
    setMessages(Array.isArray(d.messages) ? d.messages : []);
    setBooted(true);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);
    setMessages((m) => [...m, { id: `tmp-${m.length}`, mine: true, sender: "user", kind: "text", content: text }]);
    try {
      const r = await fetch(`/api/network/rooms/${roomId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      }).then((x) => x.json()).catch(() => null);
      if (r?.appended?.length) {
        setMessages((m) => [...m, ...r.appended.map((a: { sender: string; kind: string; content: string }, i: number) => ({
          id: `a-${m.length}-${i}`, mine: false, sender: a.sender, kind: a.kind, content: a.content,
        }))]);
      }
      load();
    } finally {
      setBusy(false);
    }
  }

  async function voteRemove(remove: boolean) {
    setSheet(false);
    const r = await fetch(`/api/network/rooms/${roomId}/asya`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ remove }),
    }).then((x) => x.json()).catch(() => null);
    if (r?.asyaPresent === false) toast("Ася вышла из чата 🤍 Теперь приватно");
    else if (r?.waitingOther) toast("Ты за 🤍 Ждём согласия собеседника");
    else if (!remove) toast("Оставили Асю в чате");
    load();
  }

  // Позвать Асю обратно — по желанию любого участника (в любой момент).
  async function bringBack() {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/network/rooms/${roomId}/asya`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ back: true }),
      }).then((x) => x.json()).catch(() => null);
      if (r?.asyaPresent) toast("Ася снова в чате 🤍");
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <div className="sbar">
        <a className="icobtn" href="/account/network" title="назад">‹</a>
        <h1>Разговор</h1>
        <button className="icobtn right" onClick={toggleTheme} title="день / вечер">◐</button>
      </div>

      <div className="room-strip">
        {asyaPresent ? (
          <>
            <Orb className="mini-orb" />
            <span className="rs-t">Ася в чате · <b>непредвзятая сторона</b></span>
            <button className="rs-act" onClick={() => setSheet(true)}>
              {iVoted ? "Ты за уход" : "Убрать Асю"}
            </button>
          </>
        ) : (
          <>
            <span className="rs-t">🔒 Приватно · <b>Аси в чате нет</b></span>
            <button className="rs-act" onClick={bringBack} disabled={busy}>Позвать Асю</button>
          </>
        )}
      </div>

      <div className="chat room-chat">
        {!booted && (
          <div className="chat-loading"><Orb className="big-orb thinking" /><p>Открываю разговор…</p></div>
        )}
        {booted && messages.length === 0 && (
          <div className="net-empty" style={{ textAlign: "center" }}>Пока тихо. Напиши первым 🤍</div>
        )}
        {messages.map((m) =>
          m.sender === "asya" ? (
            <div className={`row assistant`} key={m.id}>
              <Orb className="mini-orb" />
              <div className={`bubble asya-note ${m.kind === "warn" ? "warn" : ""}`}>{m.content}</div>
            </div>
          ) : (
            <div className={`row ${m.mine ? "user" : "other"}`} key={m.id}>
              <div className="bubble">{m.content}</div>
            </div>
          ),
        )}
        <div ref={endRef} />
      </div>

      <div className="composer">
        <div className="field">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(); }}
            placeholder="Написать…"
            autoComplete="off"
          />
        </div>
        <button className="send" onClick={send} disabled={busy} aria-label="отправить">
          <svg viewBox="0 0 24 24"><path d="M3 20.5v-6l8-2-8-2v-6l19 8z" /></svg>
        </button>
      </div>

      <div className={`rmodal-ov ${sheet ? "on" : ""}`} onClick={() => setSheet(false)}>
        <div className="rmodal" onClick={(e) => e.stopPropagation()}>
          <Orb className="sh-orb" />
          <h3>Убрать Асю из чата?</h3>
          <p>Разговор станет полностью приватным — Аси в нём больше не будет. Нужно согласие обоих: как только собеседник тоже подтвердит, я выйду. Позвать обратно можно в любой момент.</p>
          {otherVoted && <p style={{ color: "var(--accent)" }}>Собеседник уже за — если подтвердишь, я сразу выйду.</p>}
          <button className="sheet-btn" onClick={() => voteRemove(true)}>Да, убрать Асю</button>
          {iVoted
            ? <button className="sheet-btn ghost" onClick={() => voteRemove(false)}>Передумал — оставить</button>
            : <button className="sheet-btn ghost" onClick={() => setSheet(false)}>Пусть остаётся</button>}
        </div>
      </div>

      <div className={`toast ${toastMsg ? "on" : ""}`}>{toastMsg}</div>
    </div>
  );
}
