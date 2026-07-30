"use client";

import { useEffect, useState } from "react";
import { track } from "@/lib/track";
import BookingCard from "./BookingCard";

type Booking = {
  id: number;
  service_title: string;
  datetime: string;
  master_name?: string;
  total_price?: number;
  status?: string;
};

type State = {
  items: Booking[];
  needAuth?: boolean;
  needPhone?: boolean;
  otherPhone?: boolean;
  phone?: string;
};

const STATUS_RU: Record<string, string> = {
  pending: "ждёт подтверждения",
  waiting_payment: "ждёт оплаты",
  paid: "оплачена",
  confirmed: "подтверждена",
};

// «14 августа в 15:30» — по-человечески.
function pretty(dt: string): string {
  const [d, t] = (dt || "").split(/[ T]/);
  if (!d) return dt;
  const date = new Date(`${d}T${(t || "00:00").slice(0, 5)}:00`);
  if (isNaN(date.getTime())) return dt;
  const day = date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  const tmr = new Date(today);
  tmr.setDate(tmr.getDate() + 1);
  const isTmr = date.toDateString() === tmr.toDateString();
  const when = isToday ? "сегодня" : isTmr ? "завтра" : day;
  return `${when} в ${(t || "").slice(0, 5)}`;
}

export default function MyBookingsCard({ salonName }: { salonName: string }) {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    track("bookings_checked");
    fetch("/api/salon?action=bookings")
      .then((r) => r.json())
      .then((d) => setState({ items: d.items || [], needAuth: d.needAuth, needPhone: d.needPhone, otherPhone: d.otherPhone, phone: d.phone }))
      .catch(() => setError("Не получилось посмотреть записи. Попробуй чуть позже 🤍"))
      .finally(() => setBusy(false));
  }, []);

  if (booking) return <BookingCard salonName={salonName} />;

  return (
    <div className="bcard">
      <div className="bc-head">
        <span className="bc-ic">📖</span>
        <div><b>Твои записи</b><span>{salonName}</span></div>
      </div>

      {busy && <div className="bc-empty">Смотрю…</div>}
      {error && <div className="bc-err">{error}</div>}

      {/* Не вошёл — просим подтвердить номер, а не просто назвать его. */}
      {state?.needAuth && (
        <>
          <p className="bc-note">
            Чтобы посмотреть запись, мне нужно убедиться, что это правда ты — записи это личное. Войди по номеру
            телефона, на который оформлена запись: придёт код, и я сразу всё покажу 🤍
          </p>
          <a className="btn-primary" href="/login">Подтвердить номер</a>
        </>
      )}

      {/* Вошёл через Telegram, телефона нет — предлагаем добавить. */}
      {state?.needPhone && (
        <>
          <p className="bc-note">
            Запись ищется по номеру телефона, а у меня его пока нет. Добавь номер, на который оформлена запись, — придёт
            код для подтверждения, и я посмотрю 🤍
          </p>
          <a className="btn-primary" href="/login">Добавить номер</a>
        </>
      )}

      {/* Спросили про другой номер. */}
      {state?.otherPhone && (
        <>
          <p className="bc-note">
            Я могу посмотреть записи только на твой подтверждённый номер — так чужие данные останутся в безопасности.
            Если запись оформлена на другой номер, войди с него, и я всё покажу.
          </p>
          <a className="btn-ghost" href="/login">Войти с другого номера</a>
        </>
      )}

      {/* Есть записи. */}
      {state && !state.needAuth && !state.needPhone && !state.otherPhone && state.items.length > 0 && (
        <>
          {state.items.map((b) => (
            <div className="bc-sum" key={b.id}>
              <div className="kv"><div className="k">Когда</div><div className="v">{pretty(b.datetime)}</div></div>
              <div className="kv"><div className="k">Услуга</div><div className="v">{b.service_title}</div></div>
              {b.master_name && <div className="kv"><div className="k">Мастер</div><div className="v">{b.master_name}</div></div>}
              {b.status && <div className="kv"><div className="k">Статус</div><div className="v">{STATUS_RU[b.status] || b.status}</div></div>}
            </div>
          ))}
          <p className="bc-note">Буду думать о тебе в этот день 🌸</p>
        </>
      )}

      {/* Записей нет. */}
      {state && !state.needAuth && !state.needPhone && !state.otherPhone && state.items.length === 0 && !busy && !error && (
        <>
          <p className="bc-note">Активных записей на твой номер не нашла. Хочешь, подберём время?</p>
          <button className="btn-primary" onClick={() => setBooking(true)}>Выбрать время</button>
        </>
      )}
    </div>
  );
}
