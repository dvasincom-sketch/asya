"use client";

import { useEffect, useState } from "react";

// Отображаемый и рабочий (punycode) домены API.
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
    <div className="dev-codewrap">
      <button className="dev-copy" onClick={async () => { try { await navigator.clipboard.writeText(children); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch { /* */ } }}>{copied ? "Скопировано" : "Копировать"}</button>
      <pre className="dev-code"><code>{children}</code></pre>
    </div>
  );
}

function KeysPanel() {
  const [me, setMe] = useState<{ authed: boolean; phone?: string } | null>(null);
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
    if (r?.ok) { setMe({ authed: true }); setKeys(r.keys || []); }
    else { setMe({ authed: false }); }
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
    setCode(""); setDevCode("");
    await loadMe();
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

  if (!me) return <div className="dev-card"><span className="dev-dim">Загрузка…</span></div>;

  if (!me.authed) {
    return (
      <div className="dev-card">
        <div className="dev-cardh">Вход по номеру телефона</div>
        <p className="dev-dim" style={{ marginTop: 0 }}>Тот же вход, что и в приложении Аси. После входа сможешь создать ключ и видеть свои ключи.</p>
        {stage === "phone" ? (
          <div className="dev-row">
            <input className="dev-input" inputMode="tel" placeholder="+7 900 000-00-00" value={phone} onChange={(e) => setPhone(fmtRuPhone(e.target.value))} style={{ maxWidth: 240 }} />
            <button className="dev-btn primary" disabled={busy || phone.replace(/\D/g, "").length < 11} onClick={requestCode}>{busy ? "…" : "Получить код"}</button>
          </div>
        ) : (
          <div className="dev-row">
            <input className="dev-input" inputMode="numeric" placeholder="Код из SMS" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} style={{ maxWidth: 160 }} />
            <button className="dev-btn primary" disabled={busy || code.length < 4} onClick={verify}>{busy ? "…" : "Войти"}</button>
            <button className="dev-btn" onClick={() => { setStage("phone"); setErr(""); }}>Назад</button>
            {devCode && <span className="dev-dim">Код для теста: <b>{devCode}</b></span>}
          </div>
        )}
        {err && <div className="dev-err">{err}</div>}
      </div>
    );
  }

  return (
    <div className="dev-card">
      <div className="dev-cardh" style={{ display: "flex", alignItems: "center" }}>
        <span>Твои ключи</span>
        <button className="dev-btn" style={{ marginLeft: "auto" }} onClick={logout}>Выйти</button>
      </div>
      <div className="dev-row">
        <input className="dev-input" placeholder="Название проекта (напр. content-box)" value={newName} onChange={(e) => setNewName(e.target.value)} style={{ maxWidth: 320 }} />
        <button className="dev-btn primary" onClick={createKey}>Создать ключ</button>
        {msg && <span className="dev-ok">{msg}</span>}
      </div>

      {keys.length === 0 && <p className="dev-dim">Пока нет ключей. Создай первый — он даёт доступ к API Аси.</p>}
      {keys.map((k) => (
        <div key={k.id} className="dev-key">
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <b>{k.name}</b>
            <span className={`dev-badge ${k.enabled ? "on" : "off"}`}>{k.enabled ? "активен" : "отозван/выключен"}</span>
            <span className="dev-dim" style={{ marginLeft: "auto" }}>вызовов: {k.calls}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <code className="dev-token">{reveal[k.id] ? k.token : `${k.token.slice(0, 10)}••••••••${k.token.slice(-4)}`}</code>
            <button className="dev-btn sm" onClick={() => setReveal((s) => ({ ...s, [k.id]: !s[k.id] }))}>{reveal[k.id] ? "Скрыть" : "Показать"}</button>
            <button className="dev-btn sm" onClick={() => copy(k.token)}>Копировать</button>
            <button className="dev-btn sm" onClick={() => toggle(k)}>{k.enabled ? "Выключить" : "Включить"}</button>
            <button className="dev-btn sm danger" onClick={() => revoke(k)}>Отозвать</button>
          </div>
        </div>
      ))}
      <p className="dev-dim" style={{ marginTop: 12 }}>Ключ — секрет. Храни на сервере (переменная окружения), не в браузере и не в публичном репозитории.</p>
    </div>
  );
}

export default function DevPortal() {
  return (
    <div className="dev-wrap">
      <style>{CSS}</style>
      <div className="dev-top">
        <div className="dev-top-in">
          <b>Ася API</b>
          <span className="dev-dim">для разработчиков</span>
          <a className="dev-btn sm" style={{ marginLeft: "auto" }} href="#keys">Ключи</a>
          <a className="dev-btn sm" href="#endpoints">Эндпоинты</a>
        </div>
      </div>

      <div className="dev-container">
        <h1 className="dev-h1">API Аси</h1>
        <p className="dev-lead">Единый источник для интеграции: как получить ключ, как отправлять запросы и что возвращает Ася. Базовый адрес — <code>{API_BASE_HUMAN}</code> (рабочий: <code>{API_BASE}</code>).</p>

        <section className="dev-section">
          <h2 className="dev-h2">Быстрый старт</h2>
          <ol className="dev-ol">
            <li>Войди по номеру телефона в блоке <a href="#keys">«Ключи»</a> и создай ключ.</li>
            <li>Передавай ключ в заголовке <code>Authorization: Bearer &lt;ключ&gt;</code>.</li>
            <li>Дёргай нужный эндпоинт сервер-к-серверу (не из браузера).</li>
          </ol>
          <Code>{`curl -X POST ${API_BASE}/generate \\
  -H "Authorization: Bearer $ASYA_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"input":"Привет! Ответь одним словом.","json":false}'`}</Code>
        </section>

        <section className="dev-section" id="keys">
          <h2 className="dev-h2">Ключи</h2>
          <p className="dev-dim">Один ключ = один проект. У проекта на стороне Аси лежит его контекст (документы) — сервис его не пересылает. Ключ передаётся любым из способов:</p>
          <ul className="dev-ul">
            <li><code>Authorization: Bearer &lt;ключ&gt;</code> — рекомендуется</li>
            <li>заголовок <code>x-api-key: &lt;ключ&gt;</code></li>
            <li><code>?key=&lt;ключ&gt;</code> в URL (для быстрых тестов)</li>
          </ul>
          <KeysPanel />
        </section>

        <section className="dev-section" id="endpoints">
          <h2 className="dev-h2">Эндпоинты</h2>

          <div className="dev-ep">
            <div className="dev-ep-h"><span className="dev-method">POST</span><code>/generate</code><span className="dev-dim">универсальный вызов с контекстом проекта</span></div>
            <p className="dev-dim">Системный контекст = документы проекта (на стороне Аси). Пользовательскую часть шлёшь в <code>input</code> или в OpenAI-стиле <code>messages</code>. При <code>json:true</code> Ася возвращает строго один JSON — он приходит распарсенным в поле <code>json</code>.</p>
            <table className="dev-table"><tbody>
              <tr><td><code>input</code></td><td>string</td><td>пользовательская часть (или используй <code>messages</code>)</td></tr>
              <tr><td><code>messages</code></td><td>[{`{role,content}`}]</td><td>OpenAI-стиль, вместо <code>input</code></td></tr>
              <tr><td><code>json</code></td><td>boolean</td><td><code>true</code> — вернуть распарсенный JSON</td></tr>
              <tr><td><code>system</code></td><td>string</td><td>доп. системная приписка (необязательно)</td></tr>
              <tr><td><code>maxTokens</code></td><td>number</td><td>по умолчанию 1500</td></tr>
            </tbody></table>
            <p className="dev-dim">Ответ (при <code>json:true</code>) — <b>схема Аси, не OpenAI</b>: текст в <code>output</code>, разобранный объект в <code>json</code>.</p>
            <Code>{`{ "ok": true, "project": "content-box",
  "json": { "version": "3.10.4", "tags": ["feature"], "title": "…", "changes": ["…"] },
  "output": "<сырой текст модели>" }`}</Code>
            <p className="dev-dim">Ошибки: <code>401 unauthorized</code>, <code>403 forbidden</code>, <code>400 no_input</code>, <code>bad_json</code> (в ответе будет <code>output</code> для отладки), <code>502 empty</code>.</p>
            <Code>{`const r = await fetch("${API_BASE}/generate", {
  method: "POST",
  headers: { Authorization: \`Bearer \${process.env.ASYA_KEY}\`, "Content-Type": "application/json" },
  body: JSON.stringify({ input: commitsText, json: true }),
});
const data = await r.json();
if (!data.ok) throw new Error(data.error);
if (data.json.skip) return;         // день пропущен
const release = data.json;          // {version, tags, title, changes, mkt?}`}</Code>
          </div>

          <div className="dev-ep">
            <div className="dev-ep-h"><span className="dev-method">POST</span><code>/summary</code><span className="dev-dim">транскрипт → краткое содержание</span></div>
            <p className="dev-dim">Body: <code>transcript</code> (мин. 30 симв.), необязательно <code>title</code>, <code>source</code>, <code>lang</code>, <code>refresh</code>. Кэш по хэшу. Ответ: <code>{`{ ok, tldr, points[], summary }`}</code>.</p>
          </div>

          <div className="dev-ep">
            <div className="dev-ep-h"><span className="dev-method">POST</span><code>/feedback</code><span className="dev-dim">обучение на правках редактора</span></div>
            <p className="dev-dim">Body: <code>after</code> (правильный текст), необязательно <code>before</code>, <code>title</code>, <code>source</code>, <code>kind</code>. Правки подмешиваются в будущие саммари этого проекта.</p>
          </div>

          <div className="dev-ep">
            <div className="dev-ep-h"><span className="dev-method">POST</span><code>/knowledge/video</code><span className="dev-dim">пополнить знание по видео</span></div>
            <p className="dev-dim">Body: <code>source</code> (id видео), необязательно <code>title</code>, <code>url</code>, <code>summary</code>, <code>chapters</code>.</p>
          </div>

          <div className="dev-ep">
            <div className="dev-ep-h"><span className="dev-method">POST</span><code>/ask</code><span className="dev-dim">вопрос по знанию проекта</span></div>
            <p className="dev-dim">Body: <code>q</code>. Ответ Аси со ссылкой на видео и тайм-код.</p>
          </div>
        </section>

        <section className="dev-section">
          <h2 className="dev-h2">Ошибки</h2>
          <p className="dev-dim">Все ответы — JSON с полем <code>ok</code>. При <code>ok:false</code> есть <code>error</code> (код) и часто <code>text</code> (пояснение по-русски). Коды: <code>unauthorized</code> (нет/битый ключ), <code>forbidden</code> (ключ без доступа), <code>bad_json</code>, <code>empty</code>, <code>transcript_too_short</code>.</p>
        </section>

        <footer className="dev-footer">Ася · {API_BASE_HUMAN}</footer>
      </div>
    </div>
  );
}

const CSS = `
.dev-wrap { position: relative; z-index: 2; min-height: 100vh; background: #f7f8fb; color: #1a1c22; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.dev-top { position: sticky; top: 0; z-index: 5; background: rgba(247,248,251,.85); backdrop-filter: blur(10px); border-bottom: 1px solid #e6e8ee; }
.dev-top-in { max-width: 860px; margin: 0 auto; display: flex; align-items: center; gap: 10px; padding: 12px 20px; }
.dev-container { max-width: 860px; margin: 0 auto; padding: 28px 20px 80px; }
.dev-h1 { font-size: 30px; font-weight: 700; margin: 8px 0 6px; letter-spacing: -0.02em; }
.dev-lead { font-size: 15.5px; color: #444a58; line-height: 1.6; margin: 0 0 8px; }
.dev-section { margin-top: 34px; }
.dev-h2 { font-size: 20px; font-weight: 700; margin: 0 0 12px; letter-spacing: -0.01em; }
.dev-dim { color: #6a7080; font-size: 14px; line-height: 1.6; }
.dev-ok { color: #1a7f4b; font-size: 13.5px; }
.dev-err { color: #c02626; font-size: 13.5px; margin-top: 8px; }
.dev-ol, .dev-ul { color: #444a58; font-size: 14.5px; line-height: 1.7; padding-left: 20px; }
.dev-card { background: #fff; border: 1px solid #e6e8ee; border-radius: 16px; padding: 18px; margin-top: 12px; box-shadow: 0 1px 2px rgba(20,24,40,.04); }
.dev-cardh { font-weight: 650; font-size: 15px; margin-bottom: 10px; }
.dev-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.dev-input { background: #fff; border: 1px solid #d7dbe4; border-radius: 10px; padding: 10px 12px; font-size: 14px; color: #1a1c22; outline: none; width: 100%; }
.dev-input:focus { border-color: #7c5cff; box-shadow: 0 0 0 3px rgba(124,92,255,.15); }
.dev-btn { background: #fff; border: 1px solid #d7dbe4; border-radius: 10px; padding: 9px 14px; font-size: 13.5px; color: #2a2e39; cursor: pointer; font-weight: 550; }
.dev-btn:hover { background: #f2f3f7; }
.dev-btn.primary { background: #7c5cff; border-color: #7c5cff; color: #fff; }
.dev-btn.primary:hover { background: #6b49f5; }
.dev-btn.primary:disabled { opacity: .5; cursor: default; }
.dev-btn.sm { padding: 6px 11px; font-size: 12.5px; }
.dev-btn.danger { color: #c02626; }
.dev-key { border: 1px solid #e6e8ee; border-radius: 12px; padding: 14px; margin-top: 10px; background: #fbfbfd; }
.dev-token { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; background: #f0f1f5; border: 1px solid #e2e4ea; border-radius: 8px; padding: 6px 10px; color: #33384a; }
.dev-badge { font-size: 11.5px; padding: 3px 9px; border-radius: 999px; font-weight: 600; }
.dev-badge.on { background: #e6f6ec; color: #1a7f4b; }
.dev-badge.off { background: #f0e6e6; color: #a33; }
.dev-codewrap { position: relative; margin: 10px 0; }
.dev-copy { position: absolute; top: 8px; right: 8px; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.18); color: #cfd3e0; border-radius: 8px; padding: 4px 10px; font-size: 12px; cursor: pointer; }
.dev-copy:hover { background: rgba(255,255,255,.16); }
.dev-code { background: #1c1f2b; color: #e6e8f0; border-radius: 12px; padding: 16px; overflow-x: auto; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.8px; line-height: 1.55; margin: 0; }
.dev-ep { border: 1px solid #e6e8ee; border-radius: 14px; padding: 16px; margin-top: 14px; background: #fff; }
.dev-ep-h { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }
.dev-method { background: #edeaff; color: #5b3ff0; font-weight: 700; font-size: 11.5px; padding: 3px 8px; border-radius: 6px; letter-spacing: .04em; }
.dev-ep-h code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 14px; font-weight: 600; }
.dev-table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 13.5px; }
.dev-table td { border-top: 1px solid #eceef3; padding: 7px 8px; vertical-align: top; color: #444a58; }
.dev-table td:first-child { width: 130px; }
.dev-table code, .dev-container p code, .dev-ol code, .dev-ul code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.8px; background: #f0f1f5; border: 1px solid #e6e8ee; border-radius: 6px; padding: 1px 6px; color: #4a3aa0; }
.dev-footer { margin-top: 48px; padding-top: 18px; border-top: 1px solid #e6e8ee; color: #9aa0ad; font-size: 13px; }
a { color: #5b3ff0; text-decoration: none; }
a:hover { text-decoration: underline; }
`;
