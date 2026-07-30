"use client";

import { useEffect, useState } from "react";
import { track } from "@/lib/track";

type Category = { id: number; title: string };
type Service = { id: number; title: string; price_min?: number; seance_length?: number };
type Staff = { id: number; name: string; specialization?: string };

// Маска телефона — как на экране входа.
function formatRuPhone(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("8")) d = "7" + d.slice(1);
  if (d && !d.startsWith("7")) d = "7" + d;
  d = d.slice(0, 11);
  const p = d.slice(1);
  if (!p) return d ? "+7" : "";
  let out = "+7";
  if (p.length > 0) out += " " + p.slice(0, 3);
  if (p.length >= 4) out += " " + p.slice(3, 6);
  if (p.length >= 7) out += "-" + p.slice(6, 8);
  if (p.length >= 9) out += "-" + p.slice(8, 10);
  return out;
}

// Ближайшие 14 дней для выбора даты.
function nextDays(n = 14) {
  const out: { iso: string; label: string; weekday: string }[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    out.push({
      iso: d.toISOString().slice(0, 10),
      label: i === 0 ? "сегодня" : i === 1 ? "завтра" : d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" }),
      weekday: d.toLocaleDateString("ru-RU", { weekday: "short" }),
    });
  }
  return out;
}

type Step = "service" | "date" | "master" | "who" | "done";

export default function BookingCard({ salonName }: { salonName: string }) {
  const [step, setStep] = useState<Step>("service");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [categories, setCategories] = useState<Category[]>([]);
  const [catId, setCatId] = useState<number | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [service, setService] = useState<Service | null>(null);

  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [time, setTime] = useState("");

  const [staff, setStaff] = useState<Staff[]>([]);
  const [master, setMaster] = useState<Staff | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<{ booking_id: number; payment_url: string } | null>(null);
  const [bookingUrl, setBookingUrl] = useState("");

  const duration = service?.seance_length || 3600;

  async function api(params: string) {
    const r = await fetch(`/api/salon?${params}`);
    const d = await r.json();
    if (!r.ok) throw new Error(d.text || "salon");
    return d;
  }

  // Стартовая загрузка: категории + телефон из профиля.
  useEffect(() => {
    track("booking_card_shown");
    setBusy(true);
    Promise.all([api("action=categories"), api("action=info").catch(() => null)])
      .then(([cats, info]) => {
        setCategories(cats.items || []);
        if (info?.phone) setPhone(formatRuPhone(info.phone));
        if (info?.bookingUrl) setBookingUrl(info.bookingUrl);
      })
      .catch(() => setError("Расписание пока не отвечает. Попробуй чуть позже 🤍"))
      .finally(() => setBusy(false));
  }, []);

  async function pickCategory(id: number) {
    setCatId(id);
    setBusy(true);
    setError("");
    try {
      const d = await api(`action=services&category_id=${id}`);
      setServices(d.items || []);
    } catch {
      setError("Не получилось загрузить услуги.");
    } finally {
      setBusy(false);
    }
  }

  async function pickService(s: Service) {
    setService(s);
    setStep("date");
    track("booking_service_picked");
    const days = nextDays();
    await pickDate(days[0].iso, s);
  }

  async function pickDate(iso: string, s?: Service) {
    const svc = s || service;
    if (!svc) return;
    setDate(iso);
    setTime("");
    setBusy(true);
    setError("");
    try {
      const d = await api(`action=slots&date=${iso}&duration=${svc.seance_length || 3600}&service_id=${svc.id}`);
      setSlots(d.slots || []);
    } catch {
      setError("Не получилось загрузить свободное время.");
    } finally {
      setBusy(false);
    }
  }

  async function pickTime(t: string) {
    setTime(t);
    setStep("master");
    setBusy(true);
    setError("");
    try {
      const dt = `${date} ${t}`;
      const d = await api(`action=staff&datetime=${encodeURIComponent(dt)}&duration=${duration}&service_id=${service?.id}`);
      const list: Staff[] = d.items || [];
      setStaff(list);
      if (list.length === 1) {
        setMaster(list[0]);
        setStep("who");
      }
    } catch {
      setError("Не получилось посмотреть, кто свободен.");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!service || !master || !date || !time) return;
    if (!name.trim() || phone.replace(/\D/g, "").length < 11) {
      setError("Нужно имя и телефон полностью.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/salon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: service.id,
          service_title: service.title,
          datetime: `${date} ${time}`,
          duration,
          total_price: service.price_min || 0,
          master_id: master.id,
          master_name: master.name,
          client_name: name.trim(),
          client_phone: phone,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.text || "create");
      track("booking_created");
      setResult(d);
      setStep("done");
    } catch {
      setError("Не получилось оформить запись. Попробуй ещё раз 🤍");
    } finally {
      setBusy(false);
    }
  }

  // ---------- Готово ----------
  if (step === "done" && result) {
    return (
      <div className="bcard">
        <div className="bc-head">
          <span className="bc-ic">🤍</span>
          <div><b>Записала тебя</b><span>{salonName}</span></div>
        </div>
        <div className="bc-sum">
          <div className="kv"><div className="k">Услуга</div><div className="v">{service?.title}</div></div>
          <div className="kv"><div className="k">Когда</div><div className="v">{date} в {time}</div></div>
          <div className="kv"><div className="k">Мастер</div><div className="v">{master?.name}</div></div>
        </div>
        <p className="bc-note">Осталось подтвердить бронь — и я буду знать, что ты позаботилась о себе 🌸</p>
        <a className="btn-primary" href={result.payment_url} target="_blank" rel="noopener noreferrer">
          Подтвердить бронь
        </a>
      </div>
    );
  }

  return (
    <div className="bcard">
      <div className="bc-head">
        <span className="bc-ic">🌸</span>
        <div><b>Запись в {salonName}</b><span>выберем вместе, это быстро</span></div>
      </div>

      {/* Шаг 1 — услуга */}
      {step === "service" && (
        <>
          {!catId ? (
            <>
              <div className="bc-label">С чего начнём?</div>
              <div className="bc-opts">
                {categories.map((c) => (
                  <button key={c.id} className="bc-opt" onClick={() => pickCategory(c.id)} disabled={busy}>
                    {c.title}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="bc-label">Что хочется?</div>
              <div className="bc-opts">
                {services.map((s) => (
                  <button key={s.id} className="bc-opt" onClick={() => pickService(s)} disabled={busy}>
                    <span>{s.title}</span>
                    {s.price_min ? <i>{s.price_min} ₽</i> : null}
                  </button>
                ))}
              </div>
              <button className="btn-ghost" onClick={() => { setCatId(null); setServices([]); }}>← другие услуги</button>
            </>
          )}
        </>
      )}

      {/* Шаг 2 — дата и время */}
      {step === "date" && (
        <>
          <div className="bc-label">Когда тебе удобно?</div>
          <div className="bc-days">
            {nextDays().map((d) => (
              <button
                key={d.iso}
                className={`bc-day ${date === d.iso ? "on" : ""}`}
                onClick={() => pickDate(d.iso)}
                disabled={busy}
              >
                <b>{d.label}</b><span>{d.weekday}</span>
              </button>
            ))}
          </div>
          <div className="bc-label">Свободное время</div>
          {busy ? (
            <div className="bc-empty">Смотрю расписание…</div>
          ) : slots.length ? (
            <div className="bc-times">
              {slots.map((t) => (
                <button key={t} className={`bc-time ${time === t ? "on" : ""}`} onClick={() => pickTime(t)}>{t}</button>
              ))}
            </div>
          ) : (
            <div className="bc-empty">В этот день всё занято — попробуй другой 🤍</div>
          )}
          <button className="btn-ghost" onClick={() => setStep("service")}>← к услугам</button>
        </>
      )}

      {/* Шаг 3 — мастер */}
      {step === "master" && (
        <>
          <div className="bc-label">Кто тебя примет?</div>
          {busy ? (
            <div className="bc-empty">Смотрю, кто свободен…</div>
          ) : staff.length ? (
            <div className="bc-opts">
              {staff.map((m) => (
                <button key={m.id} className="bc-opt" onClick={() => { setMaster(m); setStep("who"); }}>
                  <span>{m.name}</span>
                  {m.specialization ? <i>{m.specialization}</i> : null}
                </button>
              ))}
            </div>
          ) : (
            <div className="bc-empty">На это время мастеров нет — выберем другое время?</div>
          )}
          <button className="btn-ghost" onClick={() => setStep("date")}>← другое время</button>
        </>
      )}

      {/* Шаг 4 — имя и телефон */}
      {step === "who" && (
        <>
          <div className="bc-sum">
            <div className="kv"><div className="k">Услуга</div><div className="v">{service?.title}</div></div>
            <div className="kv"><div className="k">Когда</div><div className="v">{date} в {time}</div></div>
            <div className="kv"><div className="k">Мастер</div><div className="v">{master?.name}</div></div>
          </div>
          <div className="bc-label">Как тебя записать?</div>
          <input className="auth-input" placeholder="Имя" value={name} onChange={(e) => setName(e.target.value)} />
          <input
            className="auth-input"
            inputMode="tel"
            placeholder="+7 900 000-00-00"
            value={phone}
            onChange={(e) => setPhone(formatRuPhone(e.target.value))}
          />
          <button className="btn-primary" onClick={submit} disabled={busy}>
            {busy ? <span className="spinner" /> : "Записаться"}
          </button>
          <button className="btn-ghost" onClick={() => setStep("master")}>← назад</button>
        </>
      )}

      {error && (
        <div className="bc-err">
          {error}
          {bookingUrl && (
            <>
              {" "}
              <a href={bookingUrl} target="_blank" rel="noopener noreferrer">Открыть запись на сайте</a>
            </>
          )}
        </div>
      )}
    </div>
  );
}
