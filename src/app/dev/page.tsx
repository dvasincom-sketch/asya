"use client";

import { useEffect, useState } from "react";

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

function Code({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="devx-codewrap">
      <button className="devx-copy" onClick={async () => { try { await navigator.clipboard.writeText(children); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch { /* */ } }}>{copied ? "Скопировано" : "Копировать"}</button>
      <pre className="devx-code"><code>{children}</code></pre>
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

const NAV = [
  { id: "start", t: "Возможности" },
  { id: "keys", t: "Ключи и вход" },
  { id: "generate", t: "/generate" },
  { id: "summary", t: "/summary" },
  { id: "feedback", t: "/feedback" },
  { id: "knowledge", t: "/knowledge/video" },
  { id: "ask", t: "/ask" },
  { id: "errors", t: "Ошибки" },
];

export default function DevPortal() {
  const [active, setActive] = useState("start");
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
    <div className="devx-root">
      <style>{CSS}</style>
      <aside className="devx-side">
        <div className="devx-brand">Ася API</div>
        <div className="devx-sub">для разработчиков</div>
        <nav className="devx-nav">
          {NAV.map((n) => (
            <a key={n.id} href={`#${n.id}`} className={`devx-navlink${active === n.id ? " active" : ""}`}>{n.t}</a>
          ))}
        </nav>
        <div className="devx-side-base">{API_BASE_HUMAN}</div>
      </aside>

      <main className="devx-main">
        <h1 className="devx-h1">API Аси</h1>
        <p className="devx-lead">Один адрес для интеграции: получи ключ, отправляй запросы, читай, что возвращает Ася. Базовый адрес — <code>{API_BASE_HUMAN}</code> (рабочий: <code>{API_BASE}</code>).</p>

        <section id="start" className="devx-section">
          <h2 className="devx-h2">Возможности</h2>
          <p className="devx-dim">Ася отвечает на запросы проекта с учётом его контекста (документы проекта живут на стороне Аси и редактируются в админке). Через API можно:</p>
          <ul className="devx-features">
            <li><b>Генерация с контекстом</b> — <code>/generate</code>: отправляешь пользовательскую часть, получаешь текст или строгий JSON.</li>
            <li><b>Саммари</b> — <code>/summary</code>: транскрипт → краткое содержание с кэшем.</li>
            <li><b>Обучение</b> — <code>/feedback</code>: правки редактора становятся примерами для будущих ответов.</li>
            <li><b>Знание по видео</b> — <code>/knowledge/video</code> и <code>/ask</code>: пополняешь знание и спрашиваешь по нему.</li>
          </ul>
          <Code>{`curl -X POST ${API_BASE}/generate \\
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
          <Code>{`{ "ok": true, "project": "content-box",
  "json": { "version": "3.10.4", "tags": ["feature"], "title": "…", "changes": ["…"] },
  "output": "<сырой текст модели>" }`}</Code>
          <Code>{`const r = await fetch("${API_BASE}/generate", {
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
html { background: #ffffff !important; }
body { background: #ffffff !important; display: block !important; align-items: stretch !important; justify-content: flex-start !important; padding: 0 !important; color: #16181d !important; }
.ambient { display: none !important; }

.devx-root { position: relative; z-index: 2; display: flex; align-items: flex-start; min-height: 100vh; background: #fff; color: #16181d; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; scroll-behavior: smooth; }
.devx-side { position: sticky; top: 0; align-self: flex-start; width: 240px; flex: 0 0 240px; height: 100vh; overflow-y: auto; border-right: 1px solid #ececf1; padding: 26px 20px; box-sizing: border-box; }
.devx-brand { font-weight: 750; font-size: 17px; letter-spacing: -0.01em; }
.devx-sub { color: #9aa0ad; font-size: 12.5px; margin-top: 2px; }
.devx-nav { display: flex; flex-direction: column; gap: 1px; margin-top: 22px; }
.devx-navlink { display: block; padding: 7px 10px; border-radius: 8px; color: #4a4f5c; font-size: 13.5px; text-decoration: none; border-left: 2px solid transparent; }
.devx-navlink:hover { background: #f5f6f9; }
.devx-navlink.active { color: #5b3ff0; background: #f3f1ff; font-weight: 600; }
.devx-side-base { margin-top: 24px; color: #b7bcc7; font-size: 12px; }

.devx-main { flex: 1; min-width: 0; max-width: 880px; padding: 40px 48px 90px; box-sizing: border-box; }
.devx-h1 { font-size: 30px; font-weight: 750; margin: 0 0 8px; letter-spacing: -0.02em; }
.devx-lead { font-size: 15.5px; color: #4a4f5c; line-height: 1.6; margin: 0; }
.devx-section { margin-top: 40px; scroll-margin-top: 20px; }
.devx-h2 { font-size: 21px; font-weight: 700; margin: 0 0 12px; letter-spacing: -0.01em; }
.devx-dim { color: #6a7080; font-size: 14.5px; line-height: 1.65; }
.devx-ok { color: #1a7f4b; font-size: 13.5px; }
.devx-err { color: #c02626; font-size: 13.5px; margin-top: 8px; }
.devx-features { list-style: none; padding: 0; margin: 10px 0 0; }
.devx-features li { padding: 9px 0; border-top: 1px solid #f0f1f4; color: #4a4f5c; font-size: 14.5px; line-height: 1.6; }
.devx-features li:first-child { border-top: none; }

.devx-panel { background: #fbfbfd; border: 1px solid #e9eaf0; border-radius: 14px; padding: 18px; margin-top: 14px; }
.devx-panelh { font-weight: 650; font-size: 15px; margin-bottom: 10px; }
.devx-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.devx-input { background: #fff; border: 1px solid #d7dbe4; border-radius: 10px; padding: 10px 12px; font-size: 14px; color: #16181d; outline: none; width: 100%; }
.devx-input:focus { border-color: #7c5cff; box-shadow: 0 0 0 3px rgba(124,92,255,.14); }
.devx-btn { background: #fff; border: 1px solid #d7dbe4; border-radius: 10px; padding: 9px 14px; font-size: 13.5px; color: #2a2e39; cursor: pointer; font-weight: 550; }
.devx-btn:hover { background: #f2f3f7; }
.devx-btn.primary { background: #5b3ff0; border-color: #5b3ff0; color: #fff; }
.devx-btn.primary:hover { background: #4c31de; }
.devx-btn.primary:disabled { opacity: .5; cursor: default; }
.devx-btn.sm { padding: 6px 11px; font-size: 12.5px; }
.devx-btn.danger { color: #c02626; }
.devx-key { border: 1px solid #e9eaf0; border-radius: 12px; padding: 14px; margin-top: 10px; background: #fff; }
.devx-token { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; background: #f2f3f7; border: 1px solid #e6e8ee; border-radius: 8px; padding: 6px 10px; color: #33384a; }
.devx-badge { font-size: 11.5px; padding: 3px 9px; border-radius: 999px; font-weight: 600; }
.devx-badge.on { background: #e6f6ec; color: #1a7f4b; }
.devx-badge.off { background: #f0e6e6; color: #a33; }

.devx-codewrap { position: relative; margin: 12px 0; }
.devx-copy { position: absolute; top: 8px; right: 8px; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.18); color: #cfd3e0; border-radius: 8px; padding: 4px 10px; font-size: 12px; cursor: pointer; }
.devx-copy:hover { background: rgba(255,255,255,.16); }
.devx-code { background: #1b1e27; color: #e6e8f0; border-radius: 12px; padding: 16px; overflow-x: auto; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.8px; line-height: 1.55; margin: 0; }

.devx-ep-h { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }
.devx-method { background: #edeaff; color: #5b3ff0; font-weight: 700; font-size: 11.5px; padding: 3px 8px; border-radius: 6px; letter-spacing: .04em; }
.devx-path { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 15px; font-weight: 650; }
.devx-table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 13.5px; }
.devx-table td { border-top: 1px solid #eef0f3; padding: 7px 10px 7px 0; vertical-align: top; color: #4a4f5c; }
.devx-table td:first-child { width: 130px; }
.devx-main code, .devx-features code, .devx-dim code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.8px; background: #f2f3f7; border: 1px solid #e9eaf0; border-radius: 6px; padding: 1px 6px; color: #4a3aa0; }
.devx-footer { margin-top: 52px; padding-top: 20px; border-top: 1px solid #ececf1; color: #9aa0ad; font-size: 13px; }

@media (max-width: 900px) {
  .devx-root { flex-direction: column; }
  .devx-side { position: static; width: 100%; height: auto; flex: none; border-right: none; border-bottom: 1px solid #ececf1; padding: 16px 20px; }
  .devx-nav { flex-direction: row; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
  .devx-navlink { border-left: none; }
  .devx-side-base { display: none; }
  .devx-main { padding: 24px 20px 70px; max-width: none; }
}
`;
