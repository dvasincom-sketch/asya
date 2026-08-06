"use client";

import { useEffect, useState } from "react";

type Call = {
  id: string; fromNumber: string | null; fromName: string | null; startedAt: string;
  durationSec: number; transcript: string | null; summary: string | null;
  importance: string; category: string | null; handled: boolean;
};

const IMP: Record<string, { label: string; cls: string }> = {
  spam: { label: "спам", cls: "imp-spam" },
  low: { label: "неважное", cls: "imp-low" },
  normal: { label: "обычное", cls: "imp-normal" },
  important: { label: "важное", cls: "imp-important" },
  unknown: { label: "—", cls: "imp-low" },
};

function relTime(s: string): string {
  const d = new Date(s).getTime();
  if (!d) return "";
  const diff = Date.now() - d;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "только что";
  if (min < 60) return `${min} мин назад`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} ч назад`;
  const days = Math.floor(h / 24);
  if (days === 1) return "вчера";
  if (days < 7) return `${days} дн назад`;
  try { return new Date(s).toLocaleDateString("ru-RU", { day: "numeric", month: "long" }); } catch { return ""; }
}

function toggleTheme() {
  const el = document.documentElement;
  el.dataset.theme = el.dataset.theme === "day" ? "dusk" : "day";
}

export default function CallsScreen() {
  const [calls, setCalls] = useState<Call[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/calls")
      .then((r) => r.json())
      .then((d) => {
        setCalls(Array.isArray(d.calls) ? d.calls : []);
        if (d.unread > 0) {
          fetch("/api/calls", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ markAllRead: true }) }).catch(() => {});
        }
      })
      .catch(() => setCalls([]));
  }, []);

  return (
    <div className="app">
      <div className="sbar">
        <a className="icobtn" href="/account" title="назад">‹</a>
        <h1>Звонки</h1>
        <button className="icobtn right" onClick={toggleTheme} title="день / вечер">◐</button>
      </div>

      <div className="sbody">
        {calls === null && <div className="rooms-empty">Загружаю…</div>}

        {calls !== null && calls.length === 0 && (
          <div className="calls-empty">
            <p><b>Ася отвечает на звонки, когда ты не можешь.</b></p>
            <p>Сюда попадут звонки, которые она приняла вместо тебя: кто звонил, по какому вопросу и что просили передать. Спам она распознаёт и помечает. Чтобы включить — настрой переадресацию неотвеченных звонков на номер ассистента.</p>
          </div>
        )}

        {calls?.map((c) => {
          const imp = IMP[c.importance] || IMP.unknown;
          const isOpen = open === c.id;
          return (
            <div className={`call-card${isOpen ? " open" : ""}`} key={c.id} onClick={() => setOpen(isOpen ? null : c.id)}>
              <div className="call-top">
                <span className="call-who">{c.fromName || c.fromNumber || "Скрытый номер"}</span>
                <span className={`call-imp ${imp.cls}`}>{imp.label}</span>
              </div>
              <div className="call-sum">{c.summary || "—"}</div>
              <div className="call-meta">
                {c.category ? <span className="call-cat">{c.category}</span> : null}
                <span>{relTime(c.startedAt)}</span>
                {c.durationSec > 0 ? <span>· {c.durationSec} с</span> : null}
                {c.transcript ? <span className="call-more">{isOpen ? "свернуть" : "расшифровка"}</span> : null}
              </div>
              {isOpen && c.transcript ? <div className="call-tr">«{c.transcript}»</div> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
