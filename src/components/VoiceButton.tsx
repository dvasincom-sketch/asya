"use client";

import { useRef, useState } from "react";

// Кнопка «послушать» под ответом Аси. Аудио кешируется на сервере (по хешу текста),
// а blob — в этой сессии (повторное воспроизведение без запроса и без денег).
export default function VoiceButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "loading" | "playing" | "error">("idle");
  const urlRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function toggle() {
    if (state === "loading") return;
    if (state === "playing") {
      audioRef.current?.pause();
      setState("idle");
      return;
    }
    try {
      let url = urlRef.current;
      if (!url) {
        setState("loading");
        const r = await fetch("/api/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!r.ok) {
          setState("error");
          setTimeout(() => setState("idle"), 2600);
          return;
        }
        url = URL.createObjectURL(await r.blob());
        urlRef.current = url;
      }
      const a = new Audio(url);
      audioRef.current = a;
      a.onended = () => setState("idle");
      a.onerror = () => setState("error");
      setState("playing");
      await a.play();
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 2600);
    }
  }

  return (
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
  );
}
