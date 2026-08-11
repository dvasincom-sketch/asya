"use client";

import { useEffect, useState } from "react";
import { Unbounded, Manrope, JetBrains_Mono } from "next/font/google";

const fDisplay = Unbounded({ subsets: ["latin", "cyrillic"], weight: ["600", "700"], variable: "--f-display", display: "swap" });
const fSans = Manrope({ subsets: ["latin", "cyrillic"], weight: ["400", "500", "600", "700", "800"], variable: "--f-sans", display: "swap" });
const fMono = JetBrains_Mono({ subsets: ["latin", "cyrillic"], weight: ["400", "500"], variable: "--f-mono", display: "swap" });

const API_BASE = "https://api.xn--80a8a2b.online";
const API_BASE_HUMAN = "https://api.ася.online";

type Key = { id: string; name: string; token: string; capability: string; enabled: boolean; calls: number; lastUsedAt: string | null };

function fmtRuPhone(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("8")) d = "7" + d.slice(1);
  if (d && !d.startsWith("7")) d = "7" + d;
  d = d.slice(0, 11);
  const p = d.slice(1);
  let out = d ? "+7" : "";
  if (p.length > 0) out += " " + p.slice(0, 3);
  if (p.length >= 4) out += " " + p.slice(3, 6);
  if (p.length >= 7) out += "-" + p.slice(6, 8);
  if (p.length >= 9) out += "-" + p.slice(8, 10);
  return out;
}

// Лёгкая подсветка синтаксиса (bash/json/js), без зависимостей.
function hl(code: string, lang: string): string {
  const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const R: Record<string, Array<[string, RegExp]>> = {
    bash: [
      ["cm", /#[^\n]*/y],
      ["st", /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/y],
      ["url", /https?:\/\/[^\s\\]+/y],
      ["kw", /\b(?:curl|npm|npx|node)\b/y],
      ["fl", /-{1,2}[A-Za-z][\w-]*/y],
      ["var", /\$[A-Za-z_]\w*/y],
    ],
    json: [
      ["key", /"(?:\\.|[^"\\])*"(?=\s*:)/y],
      ["st", /"(?:\\.|[^"\\])*"/y],
      ["num", /-?\b\d+(?:\.\d+)?\b/y],
      ["kw", /\b(?:true|false|null)\b/y],
      ["pn", /[{}\[\]:,]/y],
    ],
    js: [
      ["cm", /\/\/[^\n]*/y],
      ["st", /`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/y],
      ["kw", /\b(?:const|let|var|await|async|function|return|new|if|else|throw|for|of|in|typeof|import|from|export)\b/y],
      ["bl", /\b(?:true|false|null|undefined)\b/y],
      ["num", /\b\d+(?:\.\d+)?\b/y],
      ["fn", /[A-Za-z_$][\w$]*(?=\s*\()/y],
    ],
  };
  const rules = R[lang] || [];
  let out = "";
  let i = 0;
  while (i < code.length) {
    let matched = false;
    for (const [cls, re] of rules) {
      re.lastIndex = i;
      const m = re.exec(code);
      if (m && m.index === i && m[0].length) {
        out += `<span class="tk-${cls}">${esc(m[0])}</span>`;
        i += m[0].length;
        matched = true;
        break;
      }
    }
    if (!matched) { out += esc(code[i]); i++; }
  }
  return out;
}

function Code({ children, lang = "bash" }: { children: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="devx-codewrap">
      <div className="devx-codebar">
        <span className="devx-lang">{lang}</span>
        <button className="devx-copy" onClick={async () => { try { await navigator.clipboard.writeText(children); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch { /* */ } }}>{copied ? "Скопировано" : "Копировать"}</button>
      </div>
      <pre className="devx-code"><code dangerouslySetInnerHTML={{ __html: hl(children, lang) }} /></pre>
    </div>
  );
}

function KeysPanel() {
  const [me, setMe] = useState<{ authed: boolean } | null>(null);
  const [stage, setStage] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [keys, setKeys] = useState<Key[]>([]);
  const [newName, setNewName] = useState("");
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState("");

  async function loadMe() {
    const r = await fetch("/api/dev/keys").then((x) => x.json()).catch(() => null);
    if (r?.ok) { setMe({ authed: true }); setKeys(r.keys || []); } else setMe({ authed: false });
  }
  useEffect(() => { void loadMe(); }, []);

  async function requestCode() {
    setErr(""); setBusy(true);
    const r = await fetch("/api/auth/otp/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone }) }).then((x) => x.json()).catch(() => null);
    setBusy(false);
    if (!r || r.error) { setErr(r?.text || "Не удалось отправить код."); return; }
    if (r.devCode) setDevCode(String(r.devCode));
    setStage("code");
  }
  async function verify() {
    setErr(""); setBusy(true);
    const r = await fetch("/api/auth/otp/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, code }) }).then((x) => x.json()).catch(() => null);
    setBusy(false);
    if (!r?.ok) { setErr(r?.text || "Код неверный или истёк."); return; }
    setCode(""); setDevCode(""); await loadMe();
  }
  async function logout() { await fetch("/api/auth/logout", { method: "POST" }).catch(() => {}); setMe({ authed: false }); setKeys([]); setStage("phone"); }

  async function createKey() {
    setMsg(""); const name = newName.trim() || "Мой проект";
    const r = await fetch("/api/dev/keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", name }) }).then((x) => x.json()).catch(() => null);
    if (!r?.ok) { setMsg("Не удалось создать ключ."); return; }
    setNewName(""); setReveal((s) => ({ ...s, [r.key.id]: true })); setMsg("Ключ создан — скопируй и сохрани его сейчас.");
    await loadMe(); setTimeout(() => setMsg(""), 4000);
  }
  async function toggle(k: Key) {
    await fetch("/api/dev/keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "toggle", id: k.id, enabled: !k.enabled }) }).catch(() => {});
    await loadMe();
  }
  async function revoke(k: Key) {
    if (!window.confirm(`Отозвать ключ «${k.name}»? Он перестанет работать.`)) return;
    await fetch("/api/dev/keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "revoke", id: k.id }) }).catch(() => {});
    await loadMe();
  }
  async function copy(t: string) { try { await navigator.clipboard.writeText(t); setMsg("Скопировано"); setTimeout(() => setMsg(""), 1200); } catch { /* */ } }

  if (!me) return <div className="devx-panel"><span className="devx-dim">Загрузка…</span></div>;

  if (!me.authed) {
    return (
      <div className="devx-panel">
        <div className="devx-panelh">Войти по номеру телефона</div>
        <p className="devx-dim" style={{ marginTop: 0 }}>Тот же вход, что и в приложении Аси. После входа появится создание ключа и список твоих ключей.</p>
        {stage === "phone" ? (
          <div className="devx-row">
            <input className="devx-input" inputMode="tel" placeholder="+7 900 000-00-00" value={phone} onChange={(e) => setPhone(fmtRuPhone(e.target.value))} style={{ maxWidth: 220 }} />
            <button className="devx-btn primary" disabled={busy || phone.replace(/\D/g, "").length < 11} onClick={requestCode}>{busy ? "…" : "Получить код"}</button>
          </div>
        ) : (
          <div className="devx-row">
            <input className="devx-input" inputMode="numeric" placeholder="Код из SMS" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} style={{ maxWidth: 150 }} />
            <button className="devx-btn primary" disabled={busy || code.length < 4} onClick={verify}>{busy ? "…" : "Войти"}</button>
            <button className="devx-btn" onClick={() => { setStage("phone"); setErr(""); }}>Назад</button>
            {devCode && <span className="devx-dim">Код для теста: <b>{devCode}</b></span>}
          </div>
        )}
        {err && <div className="devx-err">{err}</div>}
      </div>
    );
  }

  return (
    <div className="devx-panel">
      <div className="devx-panelh" style={{ display: "flex", alignItems: "center" }}>
        <span>Твои ключи</span>
        <button className="devx-btn sm" style={{ marginLeft: "auto" }} onClick={logout}>Выйти</button>
      </div>
      <div className="devx-row">
        <input className="devx-input" placeholder="Название проекта (напр. content-box)" value={newName} onChange={(e) => setNewName(e.target.value)} style={{ maxWidth: 320 }} />
        <button className="devx-btn primary" onClick={createKey}>Создать ключ</button>
        {msg && <span className="devx-ok">{msg}</span>}
      </div>

      {keys.length === 0 && <p className="devx-dim">Пока нет ключей. Создай первый — он даёт доступ к API Аси.</p>}
      {keys.map((k) => (
        <div key={k.id} className="devx-key">
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <b>{k.name}</b>
            <span className={`devx-badge ${k.enabled ? "on" : "off"}`}>{k.enabled ? "активен" : "выключен"}</span>
            <span className="devx-dim" style={{ marginLeft: "auto" }}>вызовов: {k.calls}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <code className="devx-token">{reveal[k.id] ? k.token : `${k.token.slice(0, 10)}••••••••${k.token.slice(-4)}`}</code>
            <button className="devx-btn sm" onClick={() => setReveal((s) => ({ ...s, [k.id]: !s[k.id] }))}>{reveal[k.id] ? "Скрыть" : "Показать"}</button>
            <button className="devx-btn sm" onClick={() => copy(k.token)}>Копировать</button>
            <button className="devx-btn sm" onClick={() => toggle(k)}>{k.enabled ? "Выключить" : "Включить"}</button>
            <button className="devx-btn sm danger" onClick={() => revoke(k)}>Отозвать</button>
          </div>
        </div>
      ))}
      <p className="devx-dim" style={{ marginTop: 12 }}>Ключ — секрет. Храни на сервере (переменная окружения), не в браузере и не в публичном репозитории.</p>
    </div>
  );
}

const PLAY_EX: Record<string, string> = {
  generate: `{ "input": "Привет! Ответь одним словом.", "json": false }`,
  summary: `{ "transcript": "Вставь транскрипт минимум на 30 символов, чтобы проверить саммари." }`,
  feedback: `{ "after": "Исправленный текст саммари", "source": "vid-1", "title": "Ролик" }`,
  "knowledge/video": `{ "source": "vid-1", "title": "Ролик", "summary": "Краткое содержание видео" }`,
  ask: `{ "q": "О чём это видео?" }`,
};

function Playground() {
  const [ep, setEp] = useState("generate");
  const [apiKey, setApiKey] = useState("");
  const [body, setBody] = useState(PLAY_EX.generate);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ status: number; text: string } | null>(null);

  function pickEp(v: string) { setEp(v); if (!touched) setBody(PLAY_EX[v] || "{}"); }
  async function send() {
    let parsed: unknown;
    try { parsed = JSON.parse(body); } catch { setRes({ status: 0, text: "Тело не парсится как JSON — проверь синтаксис." }); return; }
    setBusy(true); setRes(null);
    try {
      const r = await fetch(`/api/${ep}`, { method: "POST", headers: { "Content-Type": "application/json", ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) }, body: JSON.stringify(parsed) });
      const j = await r.json().catch(() => ({}));
      setRes({ status: r.status, text: JSON.stringify(j, null, 2) });
    } catch (e) {
      setRes({ status: 0, text: "Сетевая ошибка: " + (e instanceof Error ? e.message : String(e)) });
    } finally { setBusy(false); }
  }

  return (
    <div className="devx-panel">
      <div className="devx-row">
        <select className="devx-input" style={{ maxWidth: 210 }} value={ep} onChange={(e) => pickEp(e.target.value)}>
          <option value="generate">POST /generate</option>
          <option value="summary">POST /summary</option>
          <option value="feedback">POST /feedback</option>
          <option value="knowledge/video">POST /knowledge/video</option>
          <option value="ask">POST /ask</option>
        </select>
        <input className="devx-input" style={{ maxWidth: 320 }} placeholder="Ключ проекта (asya_…)" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
      </div>
      <textarea className="devx-input devx-mono" style={{ marginTop: 10, minHeight: 130, fontSize: 13, resize: "vertical" }} value={body} onChange={(e) => { setBody(e.target.value); setTouched(true); }} />
      <div className="devx-row" style={{ marginTop: 10 }}>
        <button className="devx-btn primary" onClick={send} disabled={busy}>{busy ? "Отправляю…" : "Отправить"}</button>
        {res && <span className={`devx-badge ${res.status >= 200 && res.status < 300 ? "on" : "off"}`}>HTTP {res.status || "—"}</span>}
      </div>
      {res && <div className="devx-codewrap" style={{ marginTop: 10 }}><pre className="devx-code" style={{ maxHeight: 340, overflow: "auto" }}><code dangerouslySetInnerHTML={{ __html: hl(res.text, "json") }} /></pre></div>}
      <p className="devx-dim" style={{ marginTop: 10 }}>Запрос уходит из браузера — удобно для теста. В проде дёргай API сервер-к-серверу, чтобы ключ не светился.</p>
    </div>
  );
}

const mIcon: Record<string, JSX.Element> = {
  text: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h10" /></svg>),
  code: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 8l-4 4 4 4M15 8l4 4-4 4" /></svg>),
  video: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="12" height="12" rx="2" /><path d="M15 10l6-3v10l-6-3" /></svg>),
  audio: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 10v4" /></svg>),
  image: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="M21 16l-5-5-9 9" /></svg>),
};
type Ability = { t: string; d: string; ep?: string; soon?: boolean };
type Modality = { id: string; title: string; hint: string; status: "live" | "soon"; abilities: Ability[] };
const MODALITIES: Modality[] = [
  { id: "text", title: "Текст", hint: "создание, обработка, парсинг", status: "live", abilities: [
    { t: "Создавать", d: "генерация текста, черновики, ответы", ep: "/generate" },
    { t: "Обрабатывать", d: "переписать, сократить, перевести, сменить тон", ep: "/generate" },
    { t: "Парсить и извлекать", d: "поля, теги, категории — строгим JSON", ep: "/generate" },
    { t: "Сжимать", d: "саммари длинного текста и транскриптов", ep: "/summary" },
    { t: "Отвечать по знанию", d: "вопросы по документам и видео", ep: "/ask" },
    { t: "Модерировать", d: "спам, токсичность, ссылки, имена", ep: "/moderate", soon: true },
  ] },
  { id: "code", title: "Код", hint: "генерация, объяснение, структура", status: "live", abilities: [
    { t: "Генерировать и объяснять", d: "сниппеты, разбор, преобразование", ep: "/generate" },
    { t: "Из коммитов — в человекочитаемое", d: "журнал обновлений из git-истории", ep: "/generate" },
    { t: "Структурировать в JSON", d: "строгий JSON по твоей схеме", ep: "/generate" },
  ] },
  { id: "video", title: "Видео", hint: "по транскрипту: саммари, главы", status: "live", abilities: [
    { t: "Саммари", d: "транскрипт → краткое содержание с кэшем", ep: "/summary" },
    { t: "Главы по тайм-кодам", d: "разбить видео на главы", ep: "/generate" },
    { t: "Знание по видео", d: "эталонные саммари и главы на проект", ep: "/knowledge/video" },
    { t: "Вопросы с тайм-кодами", d: "ответ со ссылкой на момент", ep: "/ask" },
    { t: "Приём videoUrl и авто-транскрипт", d: "сейчас транскрипт шлёт проект", soon: true },
  ] },
  { id: "audio", title: "Аудио", hint: "расшифровка, резюме", status: "soon", abilities: [
    { t: "Расшифровка (ASR)", d: "аудио → текст", soon: true },
    { t: "Резюме звонков и записей", d: "краткая суть и важность", soon: true },
    { t: "Есть транскрипт? — как текст", d: "обрабатывай через /generate и /summary", ep: "/generate" },
  ] },
  { id: "image", title: "Изображения", hint: "распознавание, OCR, генерация", status: "soon", abilities: [
    { t: "Распознавание и описание", d: "что на картинке (vision)", soon: true },
    { t: "Извлечение текста (OCR)", d: "текст с изображения", soon: true },
    { t: "Генерация", d: "картинка по описанию", soon: true },
  ] },
];

function Modalities() {
  const [open, setOpen] = useState("text");
  const cur = MODALITIES.find((m) => m.id === open) || MODALITIES[0];
  return (
    <div>
      <div className="devx-tiles">
        {MODALITIES.map((m) => (
          <button key={m.id} className={`devx-tile${open === m.id ? " active" : ""}`} onClick={() => setOpen(m.id)}>
            <span className="devx-tile-ic">{mIcon[m.id]}</span>
            <span className="devx-tile-t">{m.title}{m.status === "soon" && <span className="devx-soon">скоро</span>}</span>
            <span className="devx-tile-h">{m.hint}</span>
          </button>
        ))}
      </div>
      <div className="devx-detail">
        <div className="devx-detail-h">{cur.title} <span className="devx-dim" style={{ fontWeight: 400, fontSize: 13 }}>— что умеет Ася</span></div>
        {cur.abilities.map((a, i) => (
          <div key={i} className="devx-ability">
            <div className="devx-ability-main">
              <b>{a.t}</b>
              <span className="devx-dim">{a.d}</span>
            </div>
            <div className="devx-ability-side">
              {a.ep && <code className="devx-epchip">{a.ep}</code>}
              {a.soon && <span className="devx-soon">скоро</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const NAV = [
  { id: "start", t: "Возможности" },
  { id: "keys", t: "Ключи и вход" },
  { id: "playground", t: "Плейграунд" },
  { id: "generate", t: "/generate" },
  { id: "summary", t: "/summary" },
  { id: "feedback", t: "/feedback" },
  { id: "knowledge", t: "/knowledge/video" },
  { id: "ask", t: "/ask" },
  { id: "errors", t: "Ошибки" },
];

export default function DevPortal() {
  const [active, setActive] = useState("start");
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    try { const t = localStorage.getItem("asya-dev-theme"); if (t === "dark" || t === "light") setTheme(t); } catch { /* */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem("asya-dev-theme", theme); } catch { /* */ }
    const bg = theme === "dark" ? "#0e0f13" : "#ffffff";
    document.documentElement.style.background = bg;
    document.body.style.background = bg;
    return () => { document.documentElement.style.background = ""; document.body.style.background = ""; };
  }, [theme]);

  useEffect(() => {
    const els = NAV.map((n) => document.getElementById(n.id)).filter(Boolean) as HTMLElement[];
    const obs = new IntersectionObserver(
      (entries) => { for (const e of entries) if (e.isIntersecting) setActive(e.target.id); },
      { rootMargin: "-10% 0px -80% 0px", threshold: 0 },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <div className={`devx-root ${fSans.variable} ${fDisplay.variable} ${fMono.variable}`} data-theme={theme}>
      <style>{CSS}</style>
      <aside className="devx-side">
        <div className="devx-brand">Ася API</div>
        <div className="devx-sub">для разработчиков</div>
        <nav className="devx-nav">
          {NAV.map((n) => (
            <a key={n.id} href={`#${n.id}`} className={`devx-navlink${active === n.id ? " active" : ""}`}>{n.t}</a>
          ))}
        </nav>
        <button className="devx-theme" onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))} aria-label="Переключить тему">
          <span className="devx-switch" data-on={theme === "dark"}><span className="devx-switch-knob" /></span>
          <span>{theme === "dark" ? "Тёмная тема" : "Светлая тема"}</span>
        </button>
        <div className="devx-side-base">{API_BASE_HUMAN}</div>
      </aside>

      <main className="devx-main">
        <h1 className="devx-h1">API Аси</h1>
        <p className="devx-lead">Один адрес для интеграции: получи ключ, отправляй запросы, читай, что возвращает Ася. Базовый адрес — <code>{API_BASE_HUMAN}</code> (рабочий: <code>{API_BASE}</code>).</p>

        <section id="start" className="devx-section">
          <h2 className="devx-h2">Возможности</h2>
          <p className="devx-dim">Ася работает с разными типами контента. Выбери тип — увидишь, что именно она умеет и каким эндпоинтом. Контекст проекта (документы) живёт на стороне Аси.</p>
          <Modalities />

          <Code lang="bash">{`curl -X POST ${API_BASE}/generate \\
  -H "Authorization: Bearer $ASYA_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"input":"Ответь одним словом: привет?","json":false}'`}</Code>
        </section>

        <section id="keys" className="devx-section">
          <h2 className="devx-h2">Ключи и вход</h2>
          <p className="devx-dim">Войди по номеру телефона и создай свой ключ — здесь же им управляешь (показать, скопировать, выключить, отозвать). Один ключ = один проект.</p>
          <KeysPanel />
          <p className="devx-dim" style={{ marginTop: 14 }}>Ключ передаётся любым способом: <code>Authorization: Bearer &lt;ключ&gt;</code> (рекомендуется), заголовок <code>x-api-key</code> или <code>?key=</code> в URL (для тестов). Вызывай API сервер-к-серверу.</p>
        </section>

        <section id="playground" className="devx-section">
          <h2 className="devx-h2">Плейграунд</h2>
          <p className="devx-dim">Вставь ключ, выбери эндпоинт и тело запроса — и посмотри ответ Аси прямо здесь, без curl.</p>
          <Playground />
        </section>

        <section id="generate" className="devx-section">
          <div className="devx-ep-h"><span className="devx-method">POST</span><code className="devx-path">/generate</code><span className="devx-dim">универсальный вызов с контекстом проекта</span></div>
          <p className="devx-dim">Системный контекст = документы проекта. Пользовательскую часть шлёшь в <code>input</code> или в OpenAI-стиле <code>messages</code>. При <code>json:true</code> Ася возвращает строго один JSON — он приходит распарсенным в поле <code>json</code>.</p>
          <table className="devx-table"><tbody>
            <tr><td><code>input</code></td><td>string</td><td>пользовательская часть (или <code>messages</code>)</td></tr>
            <tr><td><code>messages</code></td><td>[{`{role,content}`}]</td><td>OpenAI-стиль, вместо <code>input</code></td></tr>
            <tr><td><code>json</code></td><td>boolean</td><td><code>true</code> — вернуть распарсенный JSON</td></tr>
            <tr><td><code>system</code></td><td>string</td><td>доп. системная приписка (необязательно)</td></tr>
            <tr><td><code>maxTokens</code></td><td>number</td><td>по умолчанию 1500</td></tr>
          </tbody></table>
          <p className="devx-dim">Ответ (при <code>json:true</code>) — <b>схема Аси, не OpenAI</b>: текст в <code>output</code>, разобранный объект в <code>json</code>.</p>
          <Code lang="json">{`{ "ok": true, "project": "content-box",
  "json": { "version": "3.10.4", "tags": ["feature"], "title": "…", "changes": ["…"] },
  "output": "<сырой текст модели>" }`}</Code>
          <Code lang="js">{`const r = await fetch("${API_BASE}/generate", {
  method: "POST",
  headers: { Authorization: \`Bearer \${process.env.ASYA_KEY}\`, "Content-Type": "application/json" },
  body: JSON.stringify({ input: commitsText, json: true }),
});
const data = await r.json();
if (!data.ok) throw new Error(data.error);
if (data.json.skip) return;         // день пропущен
const release = data.json;          // {version, tags, title, changes, mkt?}`}</Code>
        </section>

        <section id="summary" className="devx-section">
          <div className="devx-ep-h"><span className="devx-method">POST</span><code className="devx-path">/summary</code><span className="devx-dim">транскрипт → краткое содержание</span></div>
          <p className="devx-dim">Body: <code>transcript</code> (мин. 30 симв.), необязательно <code>title</code>, <code>source</code>, <code>lang</code>, <code>refresh</code>. Кэш по хэшу. Ответ: <code>{`{ ok, tldr, points[], summary }`}</code>.</p>
        </section>

        <section id="feedback" className="devx-section">
          <div className="devx-ep-h"><span className="devx-method">POST</span><code className="devx-path">/feedback</code><span className="devx-dim">обучение на правках редактора</span></div>
          <p className="devx-dim">Body: <code>after</code> (правильный текст), необязательно <code>before</code>, <code>title</code>, <code>source</code>, <code>kind</code>. Правки подмешиваются в будущие саммари этого проекта.</p>
        </section>

        <section id="knowledge" className="devx-section">
          <div className="devx-ep-h"><span className="devx-method">POST</span><code className="devx-path">/knowledge/video</code><span className="devx-dim">пополнить знание по видео</span></div>
          <p className="devx-dim">Body: <code>source</code> (id видео), необязательно <code>title</code>, <code>url</code>, <code>summary</code>, <code>chapters</code>.</p>
        </section>

        <section id="ask" className="devx-section">
          <div className="devx-ep-h"><span className="devx-method">POST</span><code className="devx-path">/ask</code><span className="devx-dim">вопрос по знанию проекта</span></div>
          <p className="devx-dim">Body: <code>q</code>. Ответ Аси со ссылкой на видео и тайм-код.</p>
        </section>

        <section id="errors" className="devx-section">
          <h2 className="devx-h2">Ошибки</h2>
          <p className="devx-dim">Все ответы — JSON с полем <code>ok</code>. При <code>ok:false</code> есть <code>error</code> (код) и часто <code>text</code> (пояснение по-русски). Коды: <code>unauthorized</code> (нет/битый ключ), <code>forbidden</code> (ключ без доступа), <code>bad_json</code>, <code>empty</code>, <code>transcript_too_short</code>.</p>
        </section>

        <footer className="devx-footer">Ася · {API_BASE_HUMAN}</footer>
      </main>
    </div>
  );
}

const CSS = `
body { display: block !important; align-items: stretch !important; justify-content: flex-start !important; padding: 0 !important; }
.ambient { display: none !important; }

.devx-root {
  --bg: #ffffff; --panel: #fbfbfd; --field: #ffffff; --text: #16181d; --muted: #6a7080; --dim: #9aa0ad;
  --line: #ececf1; --line-soft: #f0f1f4; --chip-bg: #f2f3f7; --chip-br: #e9eaf0; --chip-tx: #5b3ff0;
  --accent: #5b3ff0; --accent-2: #4c31de; --accent-soft: #f3f1ff;
  --code-bg: #1b1e27; --code-bar: #15171f; --code-line: #2a2e3a;
  position: relative; z-index: 2; display: flex; align-items: flex-start; min-height: 100vh;
  background: var(--bg); color: var(--text); scroll-behavior: smooth;
  font-family: var(--f-sans), ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
.devx-root[data-theme="dark"] {
  --bg: #0e0f13; --panel: #15171d; --field: #171a21; --text: #e7e9ee; --muted: #9aa1af; --dim: #6a7180;
  --line: #23262f; --line-soft: #1e212a; --chip-bg: #1e222c; --chip-br: #2a2e39; --chip-tx: #b9aef7;
  --accent: #8b74ff; --accent-2: #7c63f5; --accent-soft: #1d1a30;
  --code-bg: #0b0d12; --code-bar: #0f1116; --code-line: #20242e;
}

.devx-side { position: sticky; top: 0; align-self: flex-start; width: 244px; flex: 0 0 244px; height: 100vh; overflow-y: auto; border-right: 1px solid var(--line); padding: 26px 20px; box-sizing: border-box; }
.devx-brand { font-family: var(--f-display), var(--f-sans); font-weight: 700; font-size: 18px; letter-spacing: -0.01em; }
.devx-sub { color: var(--dim); font-size: 12.5px; margin-top: 3px; }
.devx-nav { display: flex; flex-direction: column; gap: 1px; margin-top: 22px; }
.devx-navlink { display: block; padding: 7px 10px; border-radius: 8px; color: var(--muted); font-size: 13.5px; font-weight: 500; text-decoration: none; border-left: 2px solid transparent; }
.devx-navlink:hover { background: var(--line-soft); }
.devx-navlink.active { color: var(--accent); background: var(--accent-soft); font-weight: 600; }
.devx-theme { display: flex; align-items: center; gap: 9px; background: none; border: none; cursor: pointer; color: var(--muted); font-size: 12.5px; padding: 0; margin-top: 22px; font-family: inherit; }
.devx-switch { width: 38px; height: 22px; border-radius: 999px; background: var(--chip-bg); border: 1px solid var(--line); position: relative; transition: .18s; flex: 0 0 auto; }
.devx-switch[data-on="true"] { background: var(--accent); border-color: var(--accent); }
.devx-switch-knob { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform .18s; box-shadow: 0 1px 2px rgba(0,0,0,.25); }
.devx-switch[data-on="true"] .devx-switch-knob { transform: translateX(16px); }
.devx-side-base { margin-top: 22px; color: var(--dim); font-size: 12px; font-family: var(--f-mono), monospace; }

.devx-main { flex: 1; min-width: 0; max-width: 880px; padding: 44px 48px 90px; box-sizing: border-box; }
.devx-h1 { font-family: var(--f-display), var(--f-sans); font-size: 32px; font-weight: 700; margin: 0 0 10px; letter-spacing: -0.02em; }
.devx-lead { font-size: 15.5px; color: var(--muted); line-height: 1.6; margin: 0; }
.devx-section { margin-top: 42px; scroll-margin-top: 20px; }
.devx-h2 { font-size: 22px; font-weight: 700; margin: 0 0 12px; letter-spacing: -0.01em; }
.devx-h3 { font-size: 14.5px; font-weight: 700; margin: 22px 0 6px; color: var(--text); display: flex; align-items: center; gap: 8px; }
.devx-soon { background: var(--accent-soft); color: var(--accent); font-size: 10.5px; font-weight: 700; padding: 2px 8px; border-radius: 999px; letter-spacing: .04em; text-transform: uppercase; }
.devx-dim { color: var(--muted); font-size: 14.5px; line-height: 1.65; }
.devx-ok { color: #1a9f5a; font-size: 13.5px; }
.devx-err { color: #e0555a; font-size: 13.5px; margin-top: 8px; }
.devx-features { list-style: none; padding: 0; margin: 10px 0 0; }
.devx-features li { padding: 9px 0; border-top: 1px solid var(--line-soft); color: var(--muted); font-size: 14.5px; line-height: 1.6; }
.devx-features li:first-child { border-top: none; }
.devx-features b { color: var(--text); }

.devx-panel { background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 18px; margin-top: 14px; }
.devx-panelh { font-weight: 700; font-size: 15px; margin-bottom: 10px; }
.devx-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.devx-input { background: var(--field); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; font-size: 14px; color: var(--text); outline: none; width: 100%; font-family: inherit; }
.devx-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.devx-mono { font-family: var(--f-mono), ui-monospace, monospace; }
.devx-btn { background: var(--field); border: 1px solid var(--line); border-radius: 10px; padding: 9px 14px; font-size: 13.5px; color: var(--text); cursor: pointer; font-weight: 600; font-family: inherit; }
.devx-btn:hover { background: var(--line-soft); }
.devx-btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.devx-btn.primary:hover { background: var(--accent-2); }
.devx-btn.primary:disabled { opacity: .5; cursor: default; }
.devx-btn.sm { padding: 6px 11px; font-size: 12.5px; }
.devx-btn.danger { color: #e0555a; }
.devx-key { border: 1px solid var(--line); border-radius: 12px; padding: 14px; margin-top: 10px; background: var(--field); }
.devx-token { font-family: var(--f-mono), monospace; font-size: 12.5px; background: var(--chip-bg); border: 1px solid var(--chip-br); border-radius: 8px; padding: 6px 10px; color: var(--text); }
.devx-badge { font-size: 11.5px; padding: 3px 9px; border-radius: 999px; font-weight: 600; }
.devx-badge.on { background: rgba(26,159,90,.14); color: #1a9f5a; }
.devx-badge.off { background: rgba(224,85,90,.14); color: #e0555a; }

.devx-codewrap { margin: 12px 0; border: 1px solid var(--code-line); border-radius: 12px; overflow: hidden; background: var(--code-bg); }
.devx-codebar { display: flex; align-items: center; justify-content: space-between; padding: 7px 10px 7px 14px; background: var(--code-bar); border-bottom: 1px solid var(--code-line); }
.devx-lang { color: #7d8291; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; font-family: var(--f-mono), monospace; }
.devx-copy { background: transparent; border: 1px solid rgba(255,255,255,.14); color: #b9bdca; border-radius: 7px; padding: 3px 10px; font-size: 11.5px; cursor: pointer; font-family: inherit; }
.devx-copy:hover { background: rgba(255,255,255,.08); color: #e6e8f0; }
.devx-code { background: transparent; color: #d4d4d4; padding: 15px 16px; overflow-x: auto; font-family: var(--f-mono), ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.8px; line-height: 1.6; margin: 0; }
.devx-codewrap code { background: none; border: none; padding: 0; color: inherit; font: inherit; }
.devx-code .tk-cm { color: #6a9955; font-style: italic; }
.devx-code .tk-st { color: #ce9178; }
.devx-code .tk-url { color: #ce9178; }
.devx-code .tk-kw { color: #569cd6; }
.devx-code .tk-bl { color: #569cd6; }
.devx-code .tk-num { color: #b5cea8; }
.devx-code .tk-key { color: #9cdcfe; }
.devx-code .tk-fn { color: #dcdcaa; }
.devx-code .tk-fl { color: #dcdcaa; }
.devx-code .tk-var { color: #9cdcfe; }
.devx-code .tk-pn { color: #d4d4d4; }

.devx-ep-h { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }
.devx-method { background: var(--accent-soft); color: var(--accent); font-weight: 700; font-size: 11.5px; padding: 3px 8px; border-radius: 6px; letter-spacing: .04em; }
.devx-path { font-family: var(--f-mono), monospace; font-size: 15px; font-weight: 600; }
.devx-table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 13.5px; }
.devx-table td { border-top: 1px solid var(--line); padding: 7px 10px 7px 0; vertical-align: top; color: var(--muted); }
.devx-table td:first-child { width: 130px; }
.devx-main :not(pre) > code, .devx-features code, .devx-dim code { font-family: var(--f-mono), ui-monospace, monospace; font-size: 12.6px; background: var(--chip-bg); border: 1px solid var(--chip-br); border-radius: 6px; padding: 1px 6px; color: var(--chip-tx); }
.devx-tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin: 14px 0; }
.devx-tile { text-align: left; background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 14px; cursor: pointer; display: flex; flex-direction: column; gap: 7px; font-family: inherit; transition: border-color .15s, background .15s; }
.devx-tile:hover { border-color: var(--accent); }
.devx-tile.active { border-color: var(--accent); background: var(--accent-soft); }
.devx-tile-ic { color: var(--accent); display: flex; }
.devx-tile-t { font-weight: 700; font-size: 14.5px; color: var(--text); display: flex; align-items: center; gap: 7px; }
.devx-tile-h { color: var(--dim); font-size: 12.5px; line-height: 1.4; }
.devx-detail { border: 1px solid var(--line); border-radius: 14px; padding: 4px 16px; background: var(--panel); }
.devx-detail-h { font-weight: 700; font-size: 15px; padding: 13px 0 5px; }
.devx-ability { display: flex; align-items: flex-start; gap: 12px; padding: 12px 0; border-top: 1px solid var(--line-soft); flex-wrap: wrap; }
.devx-ability:first-of-type { border-top: none; }
.devx-ability-main { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 180px; }
.devx-ability-main b { font-size: 14px; color: var(--text); }
.devx-ability-main .devx-dim { font-size: 13px; }
.devx-ability-side { display: flex; align-items: center; gap: 7px; flex: 0 0 auto; }
.devx-epchip { font-family: var(--f-mono), monospace; font-size: 11.5px; background: var(--chip-bg); border: 1px solid var(--chip-br); border-radius: 6px; padding: 2px 7px; color: var(--chip-tx); }
.devx-footer { margin-top: 52px; padding-top: 20px; border-top: 1px solid var(--line); color: var(--dim); font-size: 13px; }
.devx-root a { color: var(--accent); text-decoration: none; }
.devx-root a:hover { text-decoration: underline; }

@media (max-width: 900px) {
  .devx-root { flex-direction: column; }
  .devx-side { position: static; width: 100%; height: auto; flex: none; border-right: none; border-bottom: 1px solid var(--line); padding: 16px 20px; }
  .devx-nav { flex-direction: row; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
  .devx-navlink { border-left: none; }
  .devx-theme { margin-top: 14px; }
  .devx-side-base { display: none; }
  .devx-main { padding: 26px 20px 70px; max-width: none; }
}
`;
