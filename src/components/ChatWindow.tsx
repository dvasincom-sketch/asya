"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { Orb } from "./Orb";
import { CrisisCard } from "./CrisisCard";
import type { Contact } from "@/lib/crisis";
import { initTelegramMiniApp } from "@/lib/telegramWebApp";
import { track } from "@/lib/track";
import { clean } from "@/lib/text";
import MenuSheet from "./MenuSheet";
import RoomsSheet from "./RoomsSheet";
import { Icon } from "./Icon";
import BookingCard from "./BookingCard";
import MyBookingsCard from "./MyBookingsCard";
import { wantsBooking, asksMyBookings } from "@/lib/bookingIntent";
import { getIncCrypto, type IncCrypto } from "@/lib/incognito";
import TaroSpread from "./TaroSpread";

type TgChannel = { title: string; username: string | null; link: string | null; participants: number | null; about: string | null };

type NetSuggest = {
  kind: "offer" | "request";
  category: string;
  categoryLabel: string;
  categoryIcon: string;
  title: string;
  blurb: string;
  city: string;
  preview: string;
};

type Msg =
  | { role: "user"; kind: "text"; content: string; at?: string }
  | { role: "assistant"; kind: "text"; content: string; at?: string }
  | { role: "assistant"; kind: "crisis"; content: string; contacts: Contact[] }
  | { role: "assistant"; kind: "booking"; content: string }
  | { role: "assistant"; kind: "mybookings"; content: string }
  | { role: "assistant"; kind: "netsuggest"; content: string; sid: string; suggest: NetSuggest; done?: string }
  | { role: "assistant"; kind: "tgchannels"; content: string; channels: TgChannel[] };

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

// Разделители по дням в архиве истории (появляются, только когда человек лезет в прошлое).
function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function dayKeyOf(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function dayLabel(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (sameDay(d, now)) return "Сегодня";
  if (sameDay(d, yest)) return "Вчера";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

// Локальный кеш последней истории на устройстве — чтобы после деплоя, когда бэкенд
// на секунды недоступен, чат не был пустым. Инкогнито и режим навыка не кешируем.
const HIST_KEY = "asya_hist_v1";
type CachedMsg = { role: "user" | "assistant"; content: string; at?: string };
function writeHistCache(uid: string, rows: { role: string; content: string; at?: string }[] | null) {
  if (!rows) return;
  try {
    const msgs = rows
      .filter((m) => (m.role === "user" || m.role === "assistant") && m.content)
      .slice(-60)
      .map((m) => ({ role: m.role, content: m.content, at: m.at }));
    localStorage.setItem(HIST_KEY, JSON.stringify({ uid, msgs }));
  } catch {
    /* приватный режим браузера / переполнение — не критично */
  }
}
function readHistCache(uid: string): CachedMsg[] | null {
  try {
    const raw = localStorage.getItem(HIST_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (o?.uid !== uid || !Array.isArray(o.msgs)) return null;
    return o.msgs as CachedMsg[];
  } catch {
    return null;
  }
}

export default function ChatWindow() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [count, setCount] = useState(0);
  const [gated, setGated] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [salonName, setSalonName] = useState("");
  const [skill, setSkill] = useState<string | null>(null);
  const [skillMeta, setSkillMeta] = useState<{ title: string; icon: string; tagline: string; starters: string[]; note?: string | null } | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [incognito, setIncognito] = useState(false);
  const [incInfo, setIncInfo] = useState(false);
  const incRef = useRef<IncCrypto | null>(null);
  const normalRef = useRef<Msg[] | null>(null);
  const [booted, setBooted] = useState(false);
  const [netCount, setNetCount] = useState(0);
  const [roomsUnread, setRoomsUnread] = useState(0);
  const [roomsOpen, setRoomsOpen] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const skipAutoScroll = useRef(false);
  const [spread, setSpread] = useState<{ cards: string[]; text: string } | null>(null);
  const salonReady = salonName !== "";
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (skipAutoScroll.current) {
      skipAutoScroll.current = false;
      return;
    }
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
      // Навык из URL (?skill=nutri): свой режим, своя история, своя грунтовка.
      const skillParam = new URLSearchParams(window.location.search).get("skill");
      if (skillParam) {
        setSkill(skillParam);
        track("skill_chat_open", skillParam, true);
        fetch("/api/skills")
          .then((r) => r.json())
          .then((d) => {
            const found = Array.isArray(d.skills)
              ? d.skills.find((x: { id: string }) => x.id === skillParam)
              : null;
            if (found) setSkillMeta(found);
          })
          .catch(() => {});
      }
      // Узнаём, доступна ли запись в салон (и как он называется).
      fetch("/api/salon?action=info")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d?.salon) setSalonName(d.salon); })
        .catch(() => {});
      // Если открыто как Telegram Mini App — авторизуемся по Telegram до /api/me.
      const inTg = await initTelegramMiniApp();
      if (inTg) track("miniapp_open", undefined, true);
      if (cancelled) return;
      try {
        const d = await fetch("/api/me").then((r) => r.json());
        if (cancelled) return;
        const isAuthed = Boolean(d.user);
        setAuthed(isAuthed);
        setUserId(d.user?.id ?? null);
        if (isAuthed) {
          // Согласие на условия обязательно до сохранения переписки.
          const c = await fetch("/api/consent").then((r) => r.json()).catch(() => null);
          if (c?.needsConsent) {
            window.location.href = "/onboarding";
            return;
          }
          if (cancelled) return;
          let rows: { role: string; content: string; at?: string }[] | null = null;
          try {
            const h = await fetch("/api/history" + (skillParam ? `?skill=${encodeURIComponent(skillParam)}` : "")).then((r) => r.json());
            if (cancelled) return;
            rows = Array.isArray(h.messages) ? h.messages : [];
            setHasMore(Boolean(h.hasMore));
            setCursor(h.cursor ?? null);
            if (!skillParam && d.user.id) writeHistCache(d.user.id, rows);
          } catch {
            // Бэкенд моргнул (частый случай сразу после деплоя) — показываем последнее из кеша устройства.
            if (!skillParam && d.user.id) rows = readHistCache(d.user.id);
          }
          if (cancelled) return;
          if (rows && rows.length) {
            setMessages(
              rows
                .filter((m) => (m.role === "user" || m.role === "assistant") && m.content)
                .map((m) => ({ role: m.role as "user" | "assistant", kind: "text", content: m.content, at: m.at })),
            );
          }
          // Счётчик активности сети для бейджа на меню («твой ход»).
          fetch("/api/network/summary")
            .then((r) => r.json())
            .then((d) => { if (!cancelled) { setNetCount(Number(d?.count) || 0); setRoomsUnread(Number(d?.roomsUnread) || 0); } })
            .catch(() => {});
        }
      } catch {
        if (!cancelled) setAuthed(false);
      } finally {
        if (!cancelled) setBooted(true);
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

  // Показываем карточку записи после ответа Асей — но не две подряд.
  function offerBooking() {
    setMessages((m) => {
      const last = m[m.length - 1];
      if (last && last.kind === "booking") return m;
      return [...m, { role: "assistant", kind: "booking", content: "" }];
    });
  }

  // Показываем карточку «твои записи».
  function showMyBookings() {
    setMessages((m) => {
      const last = m[m.length - 1];
      if (last && last.kind === "mybookings") return m;
      return [...m, { role: "assistant", kind: "mybookings", content: "" }];
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

  // Одна лента: свежее грузим сразу, старое «архивируется» и подтягивается по запросу.
  async function loadOlder() {
    if (loadingMore || !cursor || incognito) return;
    setLoadingMore(true);
    setArchiveOpen(true);
    try {
      const url =
        "/api/history?before=" + encodeURIComponent(cursor) + (skill ? `&skill=${encodeURIComponent(skill)}` : "");
      const h = await fetch(url).then((r) => r.json());
      const rows: { role: string; content: string; at?: string }[] = Array.isArray(h.messages) ? h.messages : [];
      const older: Msg[] = rows
        .filter((m) => (m.role === "user" || m.role === "assistant") && m.content)
        .map((m) => ({ role: m.role as "user" | "assistant", kind: "text", content: m.content, at: m.at }));
      if (older.length) {
        skipAutoScroll.current = true;
        setMessages((cur) => [...older, ...cur]);
      }
      setHasMore(Boolean(h.hasMore));
      setCursor(h.cursor ?? null);
    } catch {
      /* ignore */
    } finally {
      setLoadingMore(false);
    }
  }

  // --- Инкогнито ---------------------------------------------------------
  // Разговор нигде не сохраняется в открытом виде. Вошедшему — шифруем ключом устройства
  // и храним нечитаемым шифротекстом; анониму — чисто эфемерно (только в этой вкладке).
  async function enterIncognito() {
    track("incognito_on");
    normalRef.current = messages;
    setInput("");
    setMessages([]);
    setIncognito(true);
    try {
      if (!localStorage.getItem("asya_inc_seen")) {
        setIncInfo(true);
        localStorage.setItem("asya_inc_seen", "1");
      }
    } catch {
      /* ignore */
    }
    if (userId) {
      const ic = await getIncCrypto(userId);
      incRef.current = ic;
      if (ic) {
        try {
          const d = await fetch("/api/private").then((r) => r.json());
          const rows: { role: string; iv: string; data: string }[] = Array.isArray(d.messages) ? d.messages : [];
          const decoded: Msg[] = [];
          for (const r of rows) {
            const text = await ic.decrypt(r.iv, r.data);
            if (text) decoded.push({ role: r.role === "user" ? "user" : "assistant", kind: "text", content: text });
          }
          if (decoded.length) setMessages(decoded);
        } catch {
          /* ignore */
        }
      }
    }
  }

  function exitIncognito() {
    track("incognito_off");
    setIncognito(false);
    setInput("");
    setMessages(normalRef.current ?? []);
    normalRef.current = null;
  }

  function toggleIncognito() {
    if (busy) return;
    if (incognito) exitIncognito();
    else void enterIncognito();
  }

  // Сохранить одно сообщение инкогнито зашифрованным (только вошедшему; аноним — эфемерно).
  function storePrivate(role: "user" | "assistant", text: string) {
    if (!incognito || !userId || !text) return;
    const ic = incRef.current;
    if (!ic) return;
    void (async () => {
      const enc = await ic.encrypt(text);
      if (!enc) return;
      fetch("/api/private", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, iv: enc.iv, data: enc.data }),
      }).catch(() => {});
    })();
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

    const askedMine = !skill && !incognito && salonReady && asksMyBookings(text);
    const askedBooking = !skill && !incognito && !askedMine && salonReady && wantsBooking(text);
    const userMsg: Msg = { role: "user", kind: "text", content: text };
    if (messages.length === 0) track("first_message");
    track("message_sent");
    setMessages((m) => [...m, userMsg]);
    bumpCount();
    storePrivate("user", text);

    const history = [...messages, userMsg]
      .filter((m) => m.kind === "text")
      .map((m) => ({ role: m.role, content: m.content }));

    setTyping(true);
    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, skill, incognito }),
      });
      const ct = resp.headers.get("content-type") || "";

      if (ct.includes("application/json")) {
        const data = await resp.json();
        setTyping(false);
        if (data.type === "crisis") {
          setMessages((m) => [...m, { role: "assistant", kind: "crisis", content: data.text, contacts: data.contacts || [] }]);
          storePrivate("assistant", data.text || "");
        } else if (resp.status === 429 && data.error === "limit") {
          // Дневной лимит исчерпан. Анониму — предлагаем войти (гейт), вошедшему — мягкое сообщение.
          if (data.needAuth) {
            track("gate_shown");
            setGated(true);
          }
          else setMessages((m) => [...m, { role: "assistant", kind: "text", content: data.text || "На сегодня достаточно 🤍" }]);
        } else if (data.type === "tgchannels") {
          setMessages((m) => [...m, { role: "assistant", kind: "tgchannels", content: data.text || "", channels: Array.isArray(data.channels) ? data.channels : [] }]);
          storePrivate("assistant", data.text || "");
        } else {
          setMessages((m) => [...m, { role: "assistant", kind: "text", content: data.text || "…" }]);
          storePrivate("assistant", data.text || "");
          if (askedMine) showMyBookings();
          else if (askedBooking) offerBooking();
        }
        return;
      }

      setTyping(false);
      const taroHeader = resp.headers.get("X-Taro-Cards");
      const taroIds = taroHeader ? taroHeader.split(",").filter(Boolean) : [];
      const isReading = taroIds.length > 0;
      if (isReading) {
        // Расклад — отдельная сцена; убираем оптимистичный запрос из ленты чата.
        setMessages((m) => m.slice(0, -1));
        setSpread({ cards: taroIds, text: "" });
      } else {
        setMessages((m) => [...m, { role: "assistant", kind: "text", content: "" }]);
      }
      const reader = resp.body?.getReader();
      if (!reader) {
        if (!isReading) updateLastAssistant("…");
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
                if (isReading) setSpread((sp) => (sp ? { ...sp, text: full } : sp));
                else updateLastAssistant(full);
              }
            } catch {
              /* неполный фрагмент */
            }
          }
        }
      }
      if (isReading) {
        setSpread((sp) => (sp ? { ...sp, text: full || "Карты легли, но слова сейчас не подобрались. Попробуй ещё раз чуть позже 🤍" } : sp));
      } else {
        if (!full) updateLastAssistant("…");
        else storePrivate("assistant", full);
        if (askedMine) showMyBookings();
        else if (askedBooking) offerBooking();
        else void maybeDetectNetwork(text);
      }
    } catch {
      setTyping(false);
      setMessages((m) => [...m, { role: "assistant", kind: "text", content: "Кажется, я не смогла ответить. Попробуй ещё раз чуть позже 🤍" }]);
    } finally {
      setBusy(false);
    }
  }

  // Ася заметила потенциальный оффер/запрос — мягко предлагает оформить (по согласию).
  async function maybeDetectNetwork(userText: string) {
    if (authed !== true || incognito || skill) return;
    try {
      const r = await fetch("/api/network/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: userText, incognito }),
      }).then((x) => x.json()).catch(() => null);
      if (!r || (r.kind !== "offer" && r.kind !== "request")) return;
      const sid = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
      setMessages((m) => [...m, { role: "assistant", kind: "netsuggest", content: "", sid, suggest: r as NetSuggest }]);
    } catch {
      /* тихо — детекция не критична */
    }
  }

  function markSuggest(sid: string, done: string) {
    setMessages((m) => m.map((x) => (x.kind === "netsuggest" && x.sid === sid ? { ...x, done } : x)));
  }

  // Согласие в чате: создаём оффер/запрос ТОЛЬКО по тапу. Стена сохранена.
  async function confirmSuggest(sid: string, s: NetSuggest, publish: boolean) {
    if (s.kind === "offer") {
      if (publish) {
        await fetch("/api/network/consent", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category: s.category, enabled: true }),
        }).catch(() => {});
        await fetch("/api/network/offers", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category: s.category, title: s.title, blurb: s.blurb, params: { city: s.city }, status: "active" }),
        }).catch(() => {});
        markSuggest(sid, "Готово 🤍 Буду иногда предлагать тебя тем, кто ищет — и по каждому спрошу тебя. Управлять можно в разделе «Сеть».");
      } else {
        await fetch("/api/network/offers", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category: s.category, title: s.title, blurb: s.blurb, params: { city: s.city }, status: "draft" }),
        }).catch(() => {});
        markSuggest(sid, "Сохранила черновиком 🤍 Включишь в разделе «Сеть», когда захочешь.");
      }
    } else {
      const res = await fetch("/api/network/requests", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: s.category, criteria: { city: s.city }, note: s.blurb, deadlineDays: 7 }),
      }).then((x) => x.json()).catch(() => ({}));
      markSuggest(sid, res && res.matched > 0
        ? `Уже нашла кое-кого (${res.matched}) 🤍 Загляни в раздел «Сеть».`
        : "Возьму паузу на неделю и поищу 🤍 Покажу только тех, кто сам согласится. Загляни потом в «Сеть».");
    }
  }

  return (
    <div className={`app${incognito ? " incognito" : ""}`}>
      <header>
        <Orb className="mini-orb" />
        <div>
          <h1>Ася</h1>
          <div className="status"><span className="dotlive" /> {incognito ? "инкогнито" : "онлайн"}</div>
        </div>
        <div className="hdr-btns">
          <button className="theme-btn" onClick={() => setRoomsOpen(true)} title="Румы — чаты" aria-label="румы">
            <Icon name="chat" />
            {roomsUnread > 0 && <span className="burger-badge">{roomsUnread > 9 ? "9+" : roomsUnread}</span>}
          </button>
          <button className="theme-btn burger" onClick={() => setMenuOpen(true)} title="меню" aria-label="меню">
            <i /><i /><i />
            {netCount > 0 && <span className="burger-badge">{netCount > 9 ? "9+" : netCount}</span>}
          </button>
        </div>
      </header>

      {skillMeta && (
        <div className="skill-strip">
          <span className="ss-ic">{skillMeta.icon}</span>
          <span className="ss-t">Навык · <b>{skillMeta.title}</b></span>
          <a className="ss-exit" href="/chat" title="вернуться в обычный чат">Выйти</a>
        </div>
      )}

      {incognito && (
        <div className="inc-strip">
          <span className="ss-ic">🕶️</span>
          <span className="ss-t">Инкогнито · <b>не сохраняется</b></span>
          <button className="ss-info" onClick={() => setIncInfo(true)} title="как это работает" aria-label="как это работает">?</button>
          <button className="ss-exit" onClick={exitIncognito}>Выключить</button>
        </div>
      )}

      <div className="chat" ref={chatRef}>
        {!booted && (
          <div className="chat-loading">
            <Orb className="big-orb thinking" />
            <p>Секунду, возвращаю наш разговор…</p>
          </div>
        )}

        {booted && hasMore && messages.length > 0 && (
          <button className="load-older" onClick={loadOlder} disabled={loadingMore}>
            {loadingMore ? "Загружаю…" : "↑ Показать более раннее"}
          </button>
        )}

        {booted && messages.length === 0 &&
          (incognito ? (
            <div className="intro">
              <div className="inc-badge">🕶️ Инкогнито</div>
              <Orb className="big-orb" />
              <h2>Здесь можно посекретничать</h2>
              <p>Этот разговор не попадает ни в историю, ни в память. Если ты в аккаунте, он хранится только зашифрованным ключом, который есть лишь на твоём устройстве, — на сервере его не прочитать. Чтобы ответить, я читаю сообщение в моменте, но читаемого следа не остаётся.</p>
              <div className="safe-chip">🔒 Ключ не уходит на сервер · выключишь — вернётся обычный чат</div>
            </div>
          ) : skillMeta ? (
            <div className="intro">
              <Orb className="big-orb" />
              <h2>{skillMeta.icon} {skillMeta.title}</h2>
              <p>{skillMeta.tagline}</p>
              {skillMeta.starters.length > 0 && (
                <div className="starters-row intro-chips">
                  {skillMeta.starters.map((st) => (
                    <button key={st} className="starter" onClick={() => send(st)}>{st}</button>
                  ))}
                </div>
              )}
              <div className="safe-chip">{skillMeta.note ?? "🌸 Это поддержка и общение, не профессиональная помощь"}</div>
            </div>
          ) : (
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
          ))}

        {messages.map((m, i) => {
          const prev = i > 0 ? messages[i - 1] : null;
          const prevAt = prev && prev.kind === "text" ? prev.at : undefined;
          // Дни показываем только когда человек полез в архив — обычная лента остаётся сплошной.
          const showDay = archiveOpen && m.kind === "text" && !!m.at && dayKeyOf(prevAt) !== dayKeyOf(m.at);
          const node =
            m.kind === "mybookings" ? (
              <div className="row assistant">
                <Orb className="mini-orb" />
                <MyBookingsCard salonName={salonName} />
              </div>
            ) : m.kind === "tgchannels" ? (
              <div className="row assistant">
                <Orb className="mini-orb" />
                <div className="tg-block">
                  {m.content && <div className="bubble">{clean(m.content)}</div>}
                  {m.channels.length > 0 && (
                    <div className="tg-cards">
                      {m.channels.map((c, ci) => (
                        <a
                          className="tg-card"
                          key={ci}
                          href={c.link || (c.username ? `https://t.me/${c.username}` : "#")}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <span className="tg-av">{c.title.trim().slice(0, 1).toUpperCase()}</span>
                          <span className="tg-cbody">
                            <b>{c.title}</b>
                            <span className="tg-meta">
                              {c.username ? `@${c.username}` : ""}
                              {c.username && c.participants ? " · " : ""}
                              {c.participants ? `${c.participants.toLocaleString("ru-RU")} подписчиков` : ""}
                            </span>
                            {c.about && <span className="tg-about">{c.about}</span>}
                          </span>
                          <span className="tg-open">↗</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : m.kind === "netsuggest" ? (
              <div className="row assistant">
                <Orb className="mini-orb" />
                <div className="net-suggest">
                  <div className="ns-head">
                    <span className="ns-ic">{m.suggest.categoryIcon}</span>
                    <b>{m.suggest.kind === "offer" ? "Заметила кое-что 🤍" : "Могу взять это на себя"}</b>
                  </div>
                  <p className="ns-text">{m.suggest.preview}</p>
                  {m.done ? (
                    <div className="ns-done">{m.done}</div>
                  ) : m.suggest.kind === "offer" ? (
                    <div className="ns-actions">
                      <button className="nbtn accent" onClick={() => confirmSuggest(m.sid, m.suggest, true)}>Да, предлагай меня 🤍</button>
                      <button className="nbtn" onClick={() => confirmSuggest(m.sid, m.suggest, false)}>Пока черновиком</button>
                      <button className="nbtn ghost" onClick={() => markSuggest(m.sid, "Хорошо, не буду 🤍")}>Не сейчас</button>
                    </div>
                  ) : (
                    <div className="ns-actions">
                      <button className="nbtn accent" onClick={() => confirmSuggest(m.sid, m.suggest, true)}>Да, поищи 🤍</button>
                      <button className="nbtn ghost" onClick={() => markSuggest(m.sid, "Хорошо, не буду 🤍")}>Не сейчас</button>
                    </div>
                  )}
                </div>
              </div>
            ) : m.kind === "booking" ? (
              <div className="row assistant">
                <Orb className="mini-orb" />
                <BookingCard salonName={salonName} />
              </div>
            ) : m.kind === "crisis" ? (
              <div className="row assistant">
                <Orb className="mini-orb" />
                <CrisisCard text={m.content} contacts={m.contacts} />
              </div>
            ) : (
              <div className={`row ${m.role}`}>
                {m.role === "assistant" && <Orb className="mini-orb" />}
                <div className="bubble">{m.role === "assistant" ? clean(m.content) : m.content}</div>
              </div>
            );
          return (
            <Fragment key={i}>
              {showDay && <div className="day-sep">{dayLabel(m.at)}</div>}
              {node}
            </Fragment>
          );
        })}

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
              placeholder={incognito ? "Здесь можно посекретничать…" : "Напиши, что чувствуешь…"}
              autoComplete="off"
            />
          </div>
          <button className="send" onClick={() => send()} disabled={busy} aria-label="отправить">
            <svg viewBox="0 0 24 24"><path d="M3 20.5v-6l8-2-8-2v-6l19 8z" /></svg>
          </button>
        </div>
      )}

      <div className={`overlay ${incInfo ? "on" : ""}`} onClick={() => setIncInfo(false)} />
      <div className={`sheet ${incInfo ? "on" : ""}`}>
        <Orb className="sh-orb" />
        <h3>Инкогнито — честно, как это работает</h3>
        <p>В этом режиме я не сохраняю разговор в историю и не запоминаю его. Если ты в аккаунте, переписка хранится только зашифрованной — ключ создаётся на твоём устройстве и никогда не попадает к нам на сервер, поэтому прочитать её там нельзя. Чтобы ответить, мне нужно прочитать сообщение в этот момент, но после ответа читаемого следа не остаётся. Если очистишь браузер или это устройство — доступ к этим записям пропадёт, так и задумано.</p>
        <button className="sheet-btn ghost" onClick={() => setIncInfo(false)}>Понятно 🤍</button>
      </div>

      {spread && <TaroSpread cards={spread.cards} text={spread.text} onClose={() => setSpread(null)} />}

      <MenuSheet open={menuOpen} onClose={() => setMenuOpen(false)} netCount={netCount} />
      <RoomsSheet open={roomsOpen} onClose={() => setRoomsOpen(false)} onIncognito={toggleIncognito} incognito={incognito} />
    </div>
  );
}
