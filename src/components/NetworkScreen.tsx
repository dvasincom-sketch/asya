"use client";

import { useEffect, useRef, useState } from "react";
import { Orb } from "./Orb";

type Cat = { id: string; label: string; icon: string; live: boolean; badge: string | null; note: string };
type Gender = "female" | "male" | null;
type Offer = { id: string; category: string; title: string; params: Record<string, unknown>; blurb: string | null; status: string };
type Req = { id: string; category: string; criteria: Record<string, unknown>; note: string | null; status: string; deadline: string | null };
type Incoming = {
  id: string; status: string;
  myOffer: { id: string; title: string; category: string } | null;
  request: { criteria: Record<string, unknown>; note: string | null };
  category: string | null; roomId: string | null;
};
type Cand = { introId: string; status: string; accepted: boolean; selected: boolean; offer: { title: string; blurb: string | null; category: string } | null; roomId: string | null };
type OutGroup = { requestId: string; category: string; criteria: Record<string, unknown>; note: string | null; candidates: Cand[] };
type Sheet = { title: string; text: string; btn: string; danger?: boolean; action: () => void | Promise<void> };

const CITY = (o: Record<string, unknown>) => String((o.city ?? o.location ?? "") || "");

export default function NetworkScreen() {
  const [loading, setLoading] = useState(true);
  const [cats, setCats] = useState<Cat[]>([]);
  const [consents, setConsents] = useState<Record<string, boolean>>({});
  const [gender, setGender] = useState<Gender>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [reqs, setReqs] = useState<Req[]>([]);
  const [incoming, setIncoming] = useState<Incoming[]>([]);
  const [outgoing, setOutgoing] = useState<OutGroup[]>([]);
  const [rooms, setRooms] = useState<{ id: string; asyaPresent: boolean; unread: number; last: { sender: string; content: string } | null }[]>([]);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [form, setForm] = useState<null | "offer" | "request">(null);
  const [fCat, setFCat] = useState("service");
  const [fTitle, setFTitle] = useState("");
  const [fBlurb, setFBlurb] = useState("");
  const [fCity, setFCity] = useState("");
  const [fDays, setFDays] = useState(7);
  const [toastMsg, setToastMsg] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function toast(m: string) {
    setToastMsg(m);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(""), 3000);
  }
  function toggleTheme() {
    const el = document.documentElement;
    el.dataset.theme = el.dataset.theme === "day" ? "dusk" : "day";
  }

  async function loadAll() {
    const [c, o, r, i, rm] = await Promise.all([
      fetch("/api/network/consent").then((x) => x.json()).catch(() => ({})),
      fetch("/api/network/offers").then((x) => x.json()).catch(() => ({})),
      fetch("/api/network/requests").then((x) => x.json()).catch(() => ({})),
      fetch("/api/network/intros").then((x) => x.json()).catch(() => ({})),
      fetch("/api/network/rooms").then((x) => x.json()).catch(() => ({})),
    ]);
    setCats(Array.isArray(c.categories) ? c.categories : []);
    setConsents(c.consents || {});
    setGender((c.gender as Gender) ?? null);
    setOffers(Array.isArray(o.offers) ? o.offers : []);
    setReqs(Array.isArray(r.requests) ? r.requests : []);
    setIncoming(Array.isArray(i.incoming) ? i.incoming : []);
    setOutgoing(Array.isArray(i.outgoing) ? i.outgoing : []);
    setRooms(Array.isArray(rm.rooms) ? rm.rooms : []);
  }

  useEffect(() => {
    loadAll().finally(() => setLoading(false));
  }, []);

  // Выбор формы по роду обращения к человеку (Ася про себя — всегда женский).
  const gg = (female: string, male: string, neutral?: string) =>
    gender === "male" ? male : gender === "female" ? female : neutral ?? female;

  const liveCats = cats.filter((c) => c.live);
  const catLabel = (id: string | null) => cats.find((c) => c.id === id)?.label || "";
  const catIcon = (id: string | null) => cats.find((c) => c.id === id)?.icon || "🤍";

  function onConsent(cat: string, v: boolean) {
    setConsents((s) => ({ ...s, [cat]: v }));
    fetch("/api/network/consent", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: cat, enabled: v }),
    }).catch(() => {});
    toast(v ? "Ты в этой категории 🤍 Ася сможет знакомить по твоему согласию" : "Ася больше не будет знакомить в этой категории");
  }

  function openOfferForm() {
    setFCat(liveCats[0]?.id || "service"); setFTitle(""); setFBlurb(""); setFCity(""); setForm("offer");
  }
  function openRequestForm() {
    setFCat(liveCats[0]?.id || "service"); setFTitle(""); setFBlurb(""); setFCity(""); setFDays(7); setForm("request");
  }

  async function saveOffer(activate: boolean) {
    const body = { category: fCat, title: fTitle.trim() || "Без названия", blurb: fBlurb.trim() || null, params: { city: fCity.trim() }, status: activate ? "active" : "draft" };
    const res = await fetch("/api/network/offers", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }).then((x) => x.json()).catch(() => ({}));
    if (res.error === "need_consent") { toast("Сначала включи участие в этой категории выше 🤍"); return; }
    setForm(null);
    await loadAll();
    toast(activate ? "Опубликовано 🤍 Ася сможет предлагать тебя" : "Сохранено как черновик");
  }

  async function saveRequest() {
    const body = { category: fCat, criteria: { city: fCity.trim() }, note: fBlurb.trim() || null, deadlineDays: fDays };
    const res = await fetch("/api/network/requests", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }).then((x) => x.json()).catch(() => ({}));
    setForm(null);
    await loadAll();
    const until = new Date(Date.now() + fDays * 86400000).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
    if (res.matched > 0) toast(`Ася уже нашла подходящих (${res.matched}) 🤍 Загляни ниже`);
    else toast(`Ася возьмёт паузу и посмотрит, кто подойдёт — до ${until} 🤍`);
  }

  function setOfferStatus(o: Offer, status: string) {
    fetch("/api/network/offers", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: o.id, category: o.category, title: o.title, blurb: o.blurb, params: o.params, status }),
    }).then((x) => x.json()).then((res) => {
      if (res.error === "need_consent") { toast("Сначала включи участие в этой категории 🤍"); return; }
      setOffers((s) => s.map((x) => (x.id === o.id ? { ...x, status } : x)));
      toast(status === "active" ? "Активно 🤍" : "На паузе");
    }).catch(() => {});
  }
  function delOffer(id: string) {
    setOffers((s) => s.filter((x) => x.id !== id));
    fetch("/api/network/offers", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).catch(() => {});
    toast("Удалено");
  }
  function delRequest(id: string) {
    setReqs((s) => s.filter((x) => x.id !== id));
    fetch("/api/network/requests", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).catch(() => {});
    toast("Запрос убран");
  }

  async function introAct(introId: string, action: string, ok: string) {
    await fetch("/api/network/intros", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ introId, action }),
    }).catch(() => {});
    await loadAll();
    toast(ok);
  }
  function report(targetHint: string, introId: string) {
    // Личность скрыта — жалоба идёт по интро; сервер знает участников.
    setSheet({
      title: "Пожаловаться?",
      text: `Ася передаст жалобу на модерацию и больше не будет предлагать вас друг другу. ${targetHint}`,
      btn: "Пожаловаться и скрыть", danger: true,
      action: async () => {
        await fetch("/api/network/intros", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ introId, action: "report", reason: "network" }),
        }).catch(() => {});
        await loadAll();
        toast("Спасибо 🤍 Ася скрыла и передала на модерацию");
      },
    });
  }

  const statusRu: Record<string, string> = {
    draft: "черновик", active: "активно", paused: "на паузе",
    open: "Ася ищет", matched: "есть отклики", closed: "закрыт", expired: "срок вышел",
  };

  function chatOpen(roomId: string | null) {
    return (
      <a className="ncontact chat-open" href={roomId ? `/account/network/room/${roomId}` : "#"}>
        <b>Ася познакомила вас 🤍</b>
        <span>Открыть общий чат — общайтесь здесь, я рядом ›</span>
      </a>
    );
  }

  return (
    <div className="app">
      <div className="sbar">
        <a className="icobtn" href="/account" title="назад">‹</a>
        <h1>Сеть</h1>
        <button className="icobtn right" onClick={toggleTheme} title="день / вечер">◐</button>
      </div>

      <div className="sbody">
        <div className="net-lead">
          <Orb className="net-orb" />
          <b>Ася — непредвзятая сторона</b>
          <p>Она знакомит людей по обоюдному согласию и берёт рутину на себя: сама ищет, спрашивает, бережно сводит. Ася предлагает только то, что ты {gg("открыла сама", "открыл сам", "открыл(а) сам(а)")} — из личных разговоров она никогда ничего не берёт.</p>
        </div>

        <div className="sec">Где Ася может знакомить</div>
        <div className="scard">
          {cats.map((c) => (
            <div className="srow" key={c.id}>
              <div className="ti">
                <b className="net-cat-h">
                  {c.icon} {c.label}
                  {c.badge && <span className={`badge-soon ${c.badge === "бета" ? "beta" : ""}`}>{c.badge}</span>}
                </b>
                <span>{c.note}</span>
              </div>
              <label className={`switch ${!c.live ? "muted" : ""}`}>
                <input type="checkbox" disabled={!c.live} checked={Boolean(consents[c.id])} onChange={(e) => onConsent(c.id, e.target.checked)} />
                <span className="sl" />
              </label>
            </div>
          ))}
        </div>

        <div className="sec">Что я предлагаю</div>
        <div className="scard">
          {offers.length === 0 && <div className="net-empty">{loading ? "Загружаю…" : "Пока пусто. Расскажи, чем можешь помочь — Ася предложит тебя тем, кто ищет 🤍"}</div>}
          {offers.map((o) => (
            <div className="ncard" key={o.id}>
              <div className="ncard-head">
                <b>{catIcon(o.category)} {o.title}</b>
                <span className={`npill ${o.status}`}>{statusRu[o.status] || o.status}</span>
              </div>
              {o.blurb && <p className="ncard-blurb">{o.blurb}</p>}
              {CITY(o.params) && <span className="ncard-meta">📍 {CITY(o.params)}</span>}
              <div className="nactions">
                {o.status === "active"
                  ? <button className="nbtn" onClick={() => setOfferStatus(o, "paused")}>На паузу</button>
                  : <button className="nbtn accent" onClick={() => setOfferStatus(o, "active")}>Опубликовать</button>}
                <button className="nbtn ghost" onClick={() => setSheet({ title: "Удалить предложение?", text: "Ася перестанет предлагать тебя по нему.", btn: "Удалить", danger: true, action: () => delOffer(o.id) })}>Удалить</button>
              </div>
            </div>
          ))}
          <button className="net-add" onClick={openOfferForm}>+ Добавить предложение</button>
        </div>

        <div className="sec">Что я ищу</div>
        <div className="scard">
          {reqs.length === 0 && <div className="net-empty">{loading ? "" : "Расскажи, кого или что ищешь — Ася возьмёт паузу и сама посмотрит, кто может подойти 🤍"}</div>}
          {reqs.map((r) => (
            <div className="ncard" key={r.id}>
              <div className="ncard-head">
                <b>{catIcon(r.category)} {catLabel(r.category)}</b>
                <span className={`npill ${r.status}`}>{statusRu[r.status] || r.status}</span>
              </div>
              {r.note && <p className="ncard-blurb">{r.note}</p>}
              <span className="ncard-meta">
                {CITY(r.criteria) && <>📍 {CITY(r.criteria)} · </>}
                {r.deadline ? `до ${new Date(r.deadline).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}` : ""}
              </span>
              <div className="nactions">
                <button className="nbtn ghost" onClick={() => setSheet({ title: "Убрать запрос?", text: "Ася перестанет искать по нему.", btn: "Убрать", danger: true, action: () => delRequest(r.id) })}>Убрать</button>
              </div>
            </div>
          ))}
          <button className="net-add" onClick={openRequestForm}>+ Новый запрос</button>
        </div>

        {rooms.length > 0 && (
          <>
            <div className="sec">Разговоры</div>
            <div className="scard">
              {rooms.map((rm) => (
                <a className="room-row" href={`/account/network/room/${rm.id}`} key={rm.id}>
                  <span className="rr-ic">💬</span>
                  <span className="rr-body">
                    <b>Общий чат {rm.asyaPresent ? "· с Асей" : "· приватный"}</b>
                    <span>{rm.last ? (rm.last.sender === "asya" ? "Ася: " : "") + rm.last.content : "Пока пусто — напиши первым 🤍"}</span>
                  </span>
                  {rm.unread > 0 ? <span className="mi-badge">{rm.unread > 9 ? "9+" : rm.unread}</span> : <span className="mi-go">›</span>}
                </a>
              ))}
            </div>
          </>
        )}

        {incoming.length > 0 && (
          <>
            <div className="sec">Тебя ищут</div>
            <div className="scard">
              {incoming.map((it) => (
                <div className="ncard" key={it.id}>
                  <div className="ncard-head">
                    <b>{catIcon(it.category)} Кто-то ищет</b>
                  </div>
                  {it.myOffer && <span className="ncard-tag">по «{it.myOffer.title}»</span>}
                  {it.request.note && <p className="ncard-blurb">«{it.request.note}»</p>}
                  {CITY(it.request.criteria) && <span className="ncard-meta">📍 {CITY(it.request.criteria)}</span>}
                  {it.status === "contact_shared"
                    ? chatOpen(it.roomId)
                    : it.status === "candidate_accepted"
                      ? <div className="ncard-wait">{gg("Ты откликнулась", "Ты откликнулся", "Ты откликнул(ась)")} 🤍 Ждём, что человек выберет</div>
                      : (
                        <div className="nactions">
                          <button className="nbtn accent" onClick={() => introAct(it.id, "accept", "Ася передала твой отклик 🤍")}>Откликнуться 🤍</button>
                          <button className="nbtn ghost" onClick={() => introAct(it.id, "decline", "Скрыла")}>Не сейчас</button>
                          <button className="nbtn link" onClick={() => report("", it.id)}>Пожаловаться</button>
                        </div>
                      )}
                </div>
              ))}
            </div>
          </>
        )}

        {outgoing.length > 0 && (
          <>
            <div className="sec">Ася подобрала для тебя</div>
            {outgoing.map((g) => {
              const ready = g.candidates.filter((c) => c.accepted || c.status === "contact_shared");
              const pending = g.candidates.filter((c) => !c.accepted && c.status !== "contact_shared").length;
              return (
                <div className="scard" key={g.requestId}>
                  <div className="net-groophead">
                    {catIcon(g.category)} {catLabel(g.category)}
                    {CITY(g.criteria) && <> · 📍 {CITY(g.criteria)}</>}
                    {g.note && <> · «{g.note}»</>}
                  </div>
                  {ready.length === 0 && (
                    <div className="net-empty">
                      {pending > 0 ? `Ася нашла кое-кого (${pending}) и спрашивает их согласие — как ответят, покажу карточки 🤍` : "Пока откликов нет. Ася продолжает смотреть."}
                    </div>
                  )}
                  {ready.map((c) => (
                    <div className="cand" key={c.introId}>
                      <div className="ncard-head">
                        <b>{c.offer?.title || "Кандидат"}</b>
                        {c.selected && c.status !== "contact_shared" && <span className="npill">ждём подтверждения</span>}
                      </div>
                      {c.offer?.blurb && <p className="ncard-blurb">{c.offer.blurb}</p>}
                      {c.status === "contact_shared"
                        ? chatOpen(c.roomId)
                        : c.selected
                          ? <div className="ncard-wait">{gg("Ты выбрала", "Ты выбрал", "Ты выбрал(а)")} 🤍 Ждём подтверждения</div>
                          : (
                            <div className="nactions">
                              <button className="nbtn accent" onClick={() => introAct(c.introId, "select", "Ася передала твой выбор 🤍")}>Выбрать 🤍</button>
                              <button className="nbtn link" onClick={() => report("", c.introId)}>Пожаловаться</button>
                            </div>
                          )}
                    </div>
                  ))}
                  {pending > 0 && ready.length > 0 && <div className="net-more">Ася ещё спрашивает других ({pending})</div>}
                </div>
              );
            })}
          </>
        )}

        <div className="settings-foot">
          Ася знакомит только по обоюдному согласию и никогда не раскрывает контакты без него.<br />
          Часть категорий открывается постепенно — после проверок и правил безопасности.
        </div>
      </div>

      {/* Форма оффера/запроса */}
      <div className={`overlay ${form ? "on" : ""}`} onClick={() => setForm(null)} />
      <div className={`sheet ${form ? "on" : ""}`}>
        <h3>{form === "offer" ? "Новое предложение" : "Новый запрос"}</h3>
        {liveCats.length > 1 && (
          <div className="stat-tabs" style={{ margin: "0 0 12px" }}>
            {liveCats.map((c) => (
              <button key={c.id} className={`opt-tab ${fCat === c.id ? "on" : ""}`} onClick={() => setFCat(c.id)}>{c.icon} {c.label}</button>
            ))}
          </div>
        )}
        {form === "offer" && <input className="net-input" placeholder="Коротко: чем можешь помочь" value={fTitle} onChange={(e) => setFTitle(e.target.value)} />}
        <textarea className="net-input" rows={3} placeholder={form === "offer" ? "Пару слов о себе — по-тёплому" : "Кого или что ищешь — своими словами"} value={fBlurb} onChange={(e) => setFBlurb(e.target.value)} />
        <input className="net-input" placeholder="Город (по желанию)" value={fCity} onChange={(e) => setFCity(e.target.value)} />
        {form === "request" && (
          <div className="stat-tabs" style={{ margin: "2px 0 12px" }}>
            {[{ d: 3, l: "3 дня" }, { d: 7, l: "неделя" }, { d: 14, l: "2 недели" }].map((o) => (
              <button key={o.d} className={`opt-tab ${fDays === o.d ? "on" : ""}`} onClick={() => setFDays(o.d)}>{o.l}</button>
            ))}
          </div>
        )}
        {form === "offer"
          ? <>
              <button className="sheet-btn" onClick={() => saveOffer(true)}>Опубликовать 🤍</button>
              <button className="sheet-btn ghost" onClick={() => saveOffer(false)}>Сохранить черновик</button>
            </>
          : <button className="sheet-btn" onClick={saveRequest}>Ася, поищи 🤍</button>}
        <button className="sheet-btn ghost" onClick={() => setForm(null)}>Отмена</button>
      </div>

      {/* Подтверждения */}
      <div className={`overlay ${sheet ? "on" : ""}`} onClick={() => setSheet(null)} />
      <div className={`sheet ${sheet ? "on" : ""}`}>
        <Orb className="sh-orb" />
        <h3>{sheet?.title}</h3>
        <p>{sheet?.text}</p>
        <button className={`sheet-btn ${sheet?.danger ? "danger" : ""}`} onClick={async () => { const s = sheet; setSheet(null); if (s) await s.action(); }}>{sheet?.btn}</button>
        <button className="sheet-btn ghost" onClick={() => setSheet(null)}>Отмена</button>
      </div>

      <div className={`toast ${toastMsg ? "on" : ""}`}>{toastMsg}</div>
    </div>
  );
}
