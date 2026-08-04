"use client";

import { useEffect, useRef, useState } from "react";
import { Orb } from "./Orb";
import { track } from "@/lib/track";
import { clean, trim } from "@/lib/text";

type Attention = { code: string; name: string; value: number | null; valueText: string | null; unit: string | null; refText: string | null; flag: string | null; takenAt: string | null };
type Change = { code: string; name: string; unit: string | null; prev: number; prevAt: string | null; last: number; lastAt: string | null; deltaPct: number; direction: "up" | "down"; wasFlag: string | null; nowFlag: string | null };
type Next = { id: string; title: string; dueAt: string; source: string | null; note: string | null };
type Doc = { id: string; title: string; kind: string; docDate: string | null; lab: string | null; summary: string | null; createdAt: string };
type Tracked = { code: string; name: string; points: number };

type Overview = {
  user: { id: string } | null;
  needsConsent?: boolean;
  hasData?: boolean;
  docsCount?: number;
  attention?: Attention[];
  changes?: Change[];
  next?: Next[];
  plain?: string;
  docs?: Doc[];
  trackedCodes?: Tracked[];
};

type Point = { value: number | null; valueText: string | null; takenAt: string | null; flag: string | null; refText: string | null; unit: string | null };
type MarkerHistory = { code: string; name: string; unit: string | null; refText: string | null; refLow: number | null; refHigh: number | null; points: Point[] };

function toggleTheme() {
  const el = document.documentElement;
  el.dataset.theme = el.dataset.theme === "day" ? "dusk" : "day";
}

function dateRu(iso: string | null): string {
  if (!iso) return "дата не указана";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "дата не указана";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

function shortDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function dueRu(iso: string): string {
  const d = new Date(iso);
  const days = Math.round((d.getTime() - Date.now()) / 86400000);
  if (days < 0) return `уже пора · было ${shortDate(iso)}`;
  if (days === 0) return "сегодня";
  if (days === 1) return "завтра";
  if (days < 30) return `через ${days} дн.`;
  return dateRu(iso);
}

// Простая линия динамики без библиотек.
function Spark({ points, refLow, refHigh }: { points: Point[]; refLow: number | null; refHigh: number | null }) {
  const nums = points.filter((p) => typeof p.value === "number") as (Point & { value: number })[];
  if (nums.length < 2) return null;

  const W = 280;
  const H = 74;
  const pad = 6;
  const vals = nums.map((p) => p.value);
  const lo = Math.min(...vals, refLow ?? Infinity);
  const hi = Math.max(...vals, refHigh ?? -Infinity);
  const span = hi - lo || 1;
  const x = (i: number) => pad + (i * (W - pad * 2)) / (nums.length - 1);
  const y = (v: number) => H - pad - ((v - lo) / span) * (H - pad * 2);

  const line = nums.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const bandTop = refHigh !== null ? y(refHigh) : null;
  const bandBottom = refLow !== null ? y(refLow) : null;

  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="динамика показателя">
      {bandTop !== null && bandBottom !== null && (
        <rect x={0} y={bandTop} width={W} height={Math.max(1, bandBottom - bandTop)} className="spark-band" />
      )}
      <path d={line} className="spark-line" />
      {nums.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.value)} r={i === nums.length - 1 ? 4 : 2.6}
          className={`spark-dot ${p.flag === "low" || p.flag === "high" ? "off" : ""}`} />
      ))}
    </svg>
  );
}

export default function HealthScreen() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyConsent, setBusyConsent] = useState(false);
  const [agree, setAgree] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [uploadErr, setUploadErr] = useState("");
  const [marker, setMarker] = useState<MarkerHistory | null>(null);
  const [explain, setExplain] = useState<string | null>(null);
  const [explBusy, setExplBusy] = useState(false);
  // Главный экран должен отвечать на три вопроса сразу, а не быть длинной портянкой:
  // показываем главное, остальное — по запросу.
  const [allAtt, setAllAtt] = useState(false);
  const [allCh, setAllCh] = useState(false);
  const [allDocs, setAllDocs] = useState(false);
  const [allChips, setAllChips] = useState(false);
  const [allNx, setAllNx] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      const d = await fetch("/api/health/overview").then((r) => r.json());
      setData(d);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    track("health_open", undefined, true);
    load();
  }, []);

  async function giveConsent() {
    if (!agree || busyConsent) return;
    setBusyConsent(true);
    try {
      await fetch("/api/health/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      track("health_consent");
      setLoading(true);
      await load();
    } finally {
      setBusyConsent(false);
    }
  }

  async function upload(file: File) {
    setUploading(true);
    setUploadErr("");
    setUploadMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/health/upload", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) {
        setUploadErr((d.text || "Не получилось разобрать документ.") + (d.detail ? ` (${d.detail})` : ""));
        return;
      }
      track("health_doc_added");
      setUploadMsg(
        `Готово: «${d.doc?.title || "документ"}» — ${d.markersCount} ${d.markersCount === 1 ? "показатель" : "показателей"} 🤍`,
      );
      setLoading(true);
      await load();
    } catch {
      setUploadErr("Не получилось загрузить файл. Попробуй ещё раз.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function openMarker(code: string) {
    setExplain(null);
    try {
      const d = await fetch(`/api/health/marker?code=${encodeURIComponent(code)}`).then((r) => r.json());
      if (d.error) return;
      setMarker(d);
      // Направление берём из флага последнего числового измерения.
      const nums = (d.points || []).filter((p: Point) => typeof p.value === "number");
      const lastFlag = nums.length ? nums[nums.length - 1].flag : null;
      const dir = lastFlag === "low" || lastFlag === "high" ? lastFlag : "general";
      setExplBusy(true);
      fetch("/api/health/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name: d.name, dir }),
      })
        .then((r) => r.json())
        .then((x) => setExplain(typeof x.text === "string" ? x.text : null))
        .catch(() => {})
        .finally(() => setExplBusy(false));
    } catch {
      /* ignore */
    }
  }

  async function doneReminder(id: string) {
    await fetch("/api/health/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, done: true }),
    }).catch(() => {});
    load();
  }

  async function removeDoc(id: string) {
    await fetch("/api/health/data", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ docId: id }),
    }).catch(() => {});
    setLoading(true);
    load();
  }

  // --- Не вошёл ---
  if (!loading && data && !data.user) {
    return (
      <div className="app">
        <div className="sbar">
          <a className="icobtn" href="/account" title="назад">‹</a>
          <h1>Здоровье</h1>
        </div>
        <div className="sbody">
          <div className="gate" style={{ marginTop: 8 }}>
            <Orb className="gate-orb" />
            <h3>Здесь будет вся история твоего здоровья</h3>
            <p>Анализы из разных клиник в одном месте, динамика по годам и понятные объяснения. Войди, чтобы начать.</p>
            <a className="btn-primary" href="/login">Войти</a>
          </div>
        </div>
      </div>
    );
  }

  // --- Нужно согласие на медданные ---
  if (!loading && data?.needsConsent) {
    return (
      <div className="app">
        <div className="sbar">
          <a className="icobtn" href="/account" title="назад">‹</a>
          <h1>Здоровье</h1>
          <button className="icobtn right" onClick={toggleTheme}>◐</button>
        </div>
        <div className="sbody">
          <div className="portrait">
            <Orb className="p-orb" />
            <div>
              <h2>Одно место, которое помнит всё</h2>
              <p>
                Загружай анализы и заключения — я соберу показатели в единую историю, покажу, что изменилось с прошлого
                раза, и объясню простыми словами. Без медицинских терминов и без поиска по десяти файлам.
              </p>
            </div>
          </div>

          <div className="sec">Что важно знать</div>
          <div className="scard">
            <div className="hrow"><span className="hic">🔒</span><div><b>Это особые данные</b><span>Данные о здоровье защищены строже обычных, поэтому нужно отдельное согласие — и отдельная кнопка, чтобы всё удалить.</span></div></div>
            <div className="hrow"><span className="hic">📄</span><div><b>Сам файл я не храню</b><span>Из PDF я беру текст и показатели, а файл не сохраняю.</span></div></div>
            <div className="hrow"><span className="hic">🤍</span><div><b>Только факты из документа</b><span>Я показываю то, что напечатано, и сравниваю с прошлыми результатами. Я не ставлю диагнозов и не назначаю лечение — это работа врача.</span></div></div>
          </div>

          <label className="consent" style={{ marginTop: 16 }}>
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>
              Даю согласие на обработку и хранение моих данных о здоровье, чтобы Ася собирала историю анализов. Понимаю,
              что это не медицинская помощь, и принимаю <a href="/privacy" target="_blank">политику конфиденциальности</a>.
            </span>
          </label>
          <button className="btn-primary" disabled={!agree || busyConsent} onClick={giveConsent}>
            {busyConsent ? <span className="spinner" /> : "Начать историю здоровья"}
          </button>
        </div>
      </div>
    );
  }

  // --- История одного показателя ---
  if (marker) {
    const nums = marker.points.filter((p) => typeof p.value === "number");
    return (
      <div className="app">
        <div className="sbar">
          <button className="icobtn" onClick={() => setMarker(null)} title="назад">‹</button>
          <h1>{marker.name}</h1>
          <button className="icobtn right" onClick={toggleTheme}>◐</button>
        </div>
        <div className="sbody">
          {nums.length >= 2 ? (
            <div className="scard hchart">
              <Spark points={marker.points} refLow={marker.refLow} refHigh={marker.refHigh} />
              <div className="hchart-foot">
                {marker.refText ? `Норма лаборатории: ${marker.refText}` : "Референс в документе не указан"}
                {marker.unit ? ` · ${marker.unit}` : ""}
              </div>
            </div>
          ) : (
            <div className="d-summary">Пока одно измерение — динамика появится, когда добавишь ещё один результат.</div>
          )}

          <div className="sec">Что это значит</div>
          {explBusy && <div className="d-summary">Собираю понятное объяснение…</div>}
          {!explBusy && explain && (
            <div className="d-summary he-explain">
              {clean(explain)}
              <div className="he-dis">Это общее объяснение, не диагноз — что делать именно тебе, реши с врачом 🤍</div>
            </div>
          )}
          {!explBusy && !explain && (
            <div className="d-summary">Про этот показатель пока нечего добавить бережно и точно — лучше уточнить у врача.</div>
          )}

          <div className="sec">Все измерения</div>
          <div className="tl">
            {[...marker.points].reverse().map((p, i) => (
              <div className="moment" key={i}>
                <div className="m-date">{shortDate(p.takenAt)}</div>
                <div className="m-text">
                  <b className={p.flag === "low" || p.flag === "high" ? "off-val" : ""}>
                    {p.value ?? p.valueText}{p.unit ? ` ${p.unit}` : ""}
                  </b>
                  {p.flag === "low" && " · ниже нормы лаборатории"}
                  {p.flag === "high" && " · выше нормы лаборатории"}
                  {p.refText ? ` · норма ${p.refText}` : ""}
                </div>
              </div>
            ))}
          </div>
          <div className="hnote">Отклонения от нормы лаборатории стоит обсудить с врачом — я не ставлю диагнозов.</div>
        </div>
      </div>
    );
  }

  // --- Главный экран ---
  const att = data?.attention || [];
  const ch = data?.changes || [];
  const nx = data?.next || [];

  return (
    <div className="app">
      <div className="sbar">
        <a className="icobtn" href="/account" title="назад">‹</a>
        <h1>Здоровье</h1>
        <button className="icobtn right" onClick={toggleTheme}>◐</button>
      </div>

      <div className="sbody">
        {loading && <div className="d-summary">Собираю твою историю…</div>}

        {!loading && !data?.hasData && (
          <>
            <div className="portrait">
              <Orb className="p-orb" />
              <div>
                <h2>Начнём с одного файла</h2>
                <p>
                  Загрузи PDF с анализами — я разберу показатели, запомню их и в следующий раз сама покажу, что
                  изменилось.
                </p>
              </div>
            </div>
          </>
        )}

        {!loading && data?.hasData && (
          <>
            {/* Что сейчас важно */}
            <div className="sec">Что сейчас важно</div>
            {att.length ? (
              (allAtt ? att : att.slice(0, 3)).map((a) => (
                <button className="hmark" key={a.code} onClick={() => openMarker(a.code)}>
                  <div className="hm-top">
                    <b>{a.name}</b>
                    <span className={`hm-badge ${a.flag}`}>{a.flag === "low" ? "ниже нормы" : "выше нормы"}</span>
                  </div>
                  <div className="hm-val">
                    {a.value ?? a.valueText}{a.unit ? ` ${a.unit}` : ""}
                    {a.refText ? <em> · норма {a.refText}</em> : null}
                  </div>
                  <div className="hm-date">{dateRu(a.takenAt)}</div>
                </button>
              ))
            ) : (
              <div className="d-summary">По последним результатам всё в пределах норм, указанных лабораторией.</div>
            )}
            {att.length > 3 && (
              <button className="hmore" onClick={() => setAllAtt(!allAtt)}>
                {allAtt ? "Свернуть" : `Ещё ${att.length - 3}`}
              </button>
            )}

            {/* Что изменилось */}
            <div className="sec">Что изменилось с прошлого раза</div>
            {ch.length ? (
              (allCh ? ch : ch.slice(0, 3)).map((c) => (
                <button className="hmark" key={c.code} onClick={() => openMarker(c.code)}>
                  <div className="hm-top">
                    <b>{c.name}</b>
                    <span className={`hm-delta ${c.direction}`}>
                      {c.direction === "up" ? "↑" : "↓"} {Math.abs(c.deltaPct)}%
                    </span>
                  </div>
                  <div className="hm-val">
                    {c.prev} → {c.last}{c.unit ? ` ${c.unit}` : ""}
                  </div>
                  <div className="hm-date">
                    {shortDate(c.prevAt)} → {shortDate(c.lastAt)}
                    {c.wasFlag !== c.nowFlag && c.nowFlag === "norm" ? " · вернулся в норму лаборатории" : ""}
                    {c.wasFlag !== c.nowFlag && (c.nowFlag === "low" || c.nowFlag === "high") ? " · вышел за норму лаборатории" : ""}
                  </div>
                </button>
              ))
            ) : (
              <div className="d-summary">Заметных изменений нет — либо пока не с чем сравнивать.</div>
            )}
            {ch.length > 3 && (
              <button className="hmore" onClick={() => setAllCh(!allCh)}>
                {allCh ? "Свернуть" : `Ещё ${ch.length - 3}`}
              </button>
            )}

            {/* Объяснение простым языком */}
            {data.plain && (
              <>
                <div className="sec">Простыми словами</div>
                <div className="d-summary">{trim(data.plain, 700)}</div>
              </>
            )}

            {/* Что дальше */}
            <div className="sec">Что дальше</div>
            {nx.length ? (
              (allNx ? nx : nx.slice(0, 3)).map((n) => (
                <div className="hrem" key={n.id}>
                  <div>
                    <b>{n.title}</b>
                    <span>{dueRu(n.dueAt)}{n.source ? ` · ${n.source}` : ""}</span>
                  </div>
                  <button onClick={() => doneReminder(n.id)} title="сделано">✓</button>
                </div>
              ))
            ) : (
              <div className="d-summary">
                Напоминаний нет. Я добавляю их, только если о повторе написано в самом документе — своих обследований не
                назначаю.
              </div>
            )}
            {nx.length > 3 && (
              <button className="hmore" onClick={() => setAllNx(!allNx)}>
                {allNx ? "Свернуть" : `Ещё ${nx.length - 3}`}
              </button>
            )}
          </>
        )}

        {/* Загрузка */}
        <div className="sec">Добавить документ</div>
        <div className="scard hupload">
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
            }}
          />
          <button className="btn-primary" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? <span className="spinner" /> : "Загрузить PDF с анализами"}
          </button>
          <div className="hupload-note">
            Пока читаю только PDF с текстом — такой обычно можно скачать в личном кабинете лаборатории. Фото бланков ещё
            не распознаю.
          </div>
          {uploadMsg && <div className="hupload-ok">{uploadMsg}</div>}
          {uploadErr && <div className="auth-error">{uploadErr}</div>}
        </div>

        {/* Показатели, которые отслеживаются */}
        {!!data?.trackedCodes?.length && (
          <>
            <div className="sec">Показатели <small>нажми, чтобы посмотреть динамику</small></div>
            <div className="chips">
              {(allChips ? data.trackedCodes : data.trackedCodes.slice(0, 8)).map((t) => (
                <button className="chip hchip" key={t.code} onClick={() => openMarker(t.code)}>
                  {t.name}
                  {t.points > 1 ? <em> · {t.points}</em> : null}
                </button>
              ))}
              {data.trackedCodes.length > 8 && (
                <button className="chip hchip" onClick={() => setAllChips(!allChips)}>
                  {allChips ? "Свернуть" : `Все ${data.trackedCodes.length}`}
                </button>
              )}
            </div>
          </>
        )}

        {/* Документы */}
        {!!data?.docs?.length && (
          <>
            <div className="sec">Документы <small>{data.docsCount} всего</small></div>
            {(allDocs ? data.docs : data.docs.slice(0, 3)).map((d) => (
              <div className="hdoc" key={d.id}>
                <div className="hdoc-body">
                  <b>{d.title}</b>
                  <span>{dateRu(d.docDate)}{d.lab ? ` · ${d.lab}` : ""}</span>
                  {d.summary ? <em>{trim(d.summary, 220)}</em> : null}
                </div>
                <button className="hdoc-del" onClick={() => removeDoc(d.id)} title="удалить документ">✕</button>
              </div>
            ))}
            {data.docs.length > 3 && (
              <button className="hmore" onClick={() => setAllDocs(!allDocs)}>
                {allDocs ? "Свернуть" : `Все документы (${data.docs.length})`}
              </button>
            )}
          </>
        )}

        <div className="hnote">
          Ася помогает понимать, а не лечить: она показывает то, что напечатано в документах, и не ставит диагнозов.
          Решения о здоровье принимай с врачом. Управлять согласием и удалить все медданные можно в{" "}
          <a href="/account/settings">настройках</a>.
        </div>
      </div>
    </div>
  );
}
