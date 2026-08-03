"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";

type Room = { id: string; asyaPresent: boolean; unread: number; last: { sender: string; content: string } | null };

// «Румы» — единая точка входа в чаты: секретный чат с Асей (инкогнито),
// общие чаты по матчам и CTA попросить Асю найти человека.
export default function RoomsSheet({
  open,
  onClose,
  onIncognito,
  incognito,
}: {
  open: boolean;
  onClose: () => void;
  onIncognito: () => void;
  incognito: boolean;
}) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/network/rooms")
      .then((r) => r.json())
      .then((d) => setRooms(Array.isArray(d.rooms) ? d.rooms : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  return (
    <>
      <div className={`overlay ${open ? "on" : ""}`} onClick={onClose} />
      <div className={`sheet menu-sheet ${open ? "on" : ""}`} role="menu" aria-hidden={!open}>
        <div className="menu-grip" />
        <div className="rooms-head">Румы</div>

        <button className="menu-item" onClick={() => { onIncognito(); onClose(); }}>
          <span className="mi-ic"><Icon name="chat" /></span>
          <span className="mi-body">
            <b>Секретный чат с Асей</b>
            <span>Инкогнито — ничего не сохраняется</span>
          </span>
          <span className={`mi-go ${incognito ? "on" : ""}`}>{incognito ? "вкл" : "›"}</span>
        </button>

        {loading && <div className="rooms-empty">Загружаю…</div>}
        {!loading && rooms.length === 0 && (
          <div className="rooms-empty">Пока нет общих чатов. Как Ася кого-то подберёт по твоему запросу — разговор появится здесь 🤍</div>
        )}
        {rooms.map((rm) => (
          <a className="menu-item" href={`/account/network/room/${rm.id}`} key={rm.id}>
            <span className="mi-ic"><Icon name="network" /></span>
            <span className="mi-body">
              <b>Общий чат {rm.asyaPresent ? "· с Асей" : "· приватный"}</b>
              <span>{rm.last ? (rm.last.sender === "asya" ? "Ася: " : "") + rm.last.content : "Пусто — напиши первым"}</span>
            </span>
            {rm.unread > 0 ? <span className="mi-badge">{rm.unread > 9 ? "9+" : rm.unread}</span> : <span className="mi-go">›</span>}
          </a>
        ))}

        <a className="btn-primary rooms-cta" href="/account/network">Попросить Асю найти человека 🤍</a>
        <button className="sheet-btn ghost" onClick={onClose}>Закрыть</button>
      </div>
    </>
  );
}
