"use client";

import { useRef, useState } from "react";

// Крошечный беззвучный wav — «разблокировать» аудио внутри жеста (иначе iOS Safari
// блокирует play() после сетевого запроса).
const SILENT = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";

export default function VoiceButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "loading" | "playing" | "error">("idle");
  const urlRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (state === "loading") return;
    if (state === "playing") {
      audio.pause();
      setState("idle");
      return;
    }
    // iOS: разблокируем воспроизведение прямо в обработчике клика.
    try {
      audio.src = SILENT;
      await audio.play().catch(() => {});
      audio.pause();
    } catch {
      /* не критично */
    }
    try {
      if (!urlRef.current) {
        setState("loading");
        const r = await fetch("/api/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          console.warn("[voice] нет аудио:", r.status, d?.error, d?.reason);
          setState("error");
          setTimeout(() => setState("idle"), 2600);
          return;
        }
        urlRef.current = URL.createObjectURL(await r.blob());
      }
      audio.src = urlRef.current;
      audio.currentTime = 0;
      setState("playing");
      await audio.play();
    } catch (e) {
      console.warn("[voice] play error:", e);
      setState("error");
      setTimeout(() => setState("idle"), 2600);
    }
  }

  return (
    <>
      <button
        className={`voice-btn ${state}`}
        onClick={toggle}
        title={state === "error" ? "не получилось" : state === "playing" ? "пауза" : "послушать"}
        aria-label="послушать голосом"
      >
        {state === "loading" ? (
          <span className="voice-spin" />
        ) : state === "playing" ? (
          <svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
        ) : (
          <svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z" /><path d="M16 8.5a4 4 0 0 1 0 7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        )}
      </button>
      <audio ref={audioRef} onEnded={() => setState("idle")} preload="none" hidden />
    </>
  );
}
