// Клиентский трекинг воронки. Никакого текста разговоров — только имя события
// и обезличенный id посетителя, который живёт в localStorage.
const KEY = "asya_anon";

function anonId(): string {
  if (typeof window === "undefined") return "";
  try {
    let v = localStorage.getItem(KEY);
    if (!v) {
      v = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(KEY, v);
    }
    return v;
  } catch {
    return "";
  }
}

// Событие «однажды за сессию браузера» — чтобы не засорять воронку повторами.
const fired = new Set<string>();

export function track(name: string, meta?: string, once = false): void {
  if (typeof window === "undefined") return;
  if (once) {
    if (fired.has(name)) return;
    fired.add(name);
  }
  try {
    const body = JSON.stringify({ name, anonId: anonId(), meta });
    // keepalive — чтобы событие дошло, даже если человек сразу уходит со страницы.
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* трекинг не должен ломать интерфейс */
  }
}
