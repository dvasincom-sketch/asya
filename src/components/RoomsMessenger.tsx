"use client";

// Двухпанельные «Румы» для десктопа: список разговоров слева, сам разговор справа.
// На мобильном — список на весь экран, клик уводит на страницу комнаты (как раньше).
import { useEffect, useState, type MouseEvent } from "react";
import { Icon } from "./Icon";
import RoomScreen from "./RoomScreen";

type Room = { id: string; asyaPresent: boolean; unread: number; last: { sender: string; content: string } | null };

export default function RoomsMessenger() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    function load() {
      fetch("/api/network/rooms")
        .then((r) => r.json())
        .then((d) => { if (alive) setRooms(Array.isArray(d.rooms) ? d.rooms : []); })
        .catch(() => {})
        .finally(() => { if (alive) setLoading(false); });
    }
    load();
    const t = setInterval(load, 6000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  // На широком экране открываем разговор в правой панели; на узком — обычный переход по ссылке.
  function pick(e: MouseEvent<HTMLAnchorElement>, id: string) {
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      e.preventDefault();
      setSel(id);
    }
  }

  return (
    <div className={`rooms-app${sel ? " has-sel" : ""}`}>
      <aside className="rooms-list">
        <div className="rooms-list-head">Румы</div>
        {loading && <div className="rooms-empty">Загружаю…</div>}
        {!loading && rooms.length === 0 && (
          <div className="rooms-empty">Пока нет общих чатов. Как Ася кого-то подберёт по твоему запросу — разговор появится здесь 🤍</div>
        )}
        {rooms.map((rm) => (
          <a
            key={rm.id}
            href={`/account/network/room/${rm.id}`}
            onClick={(e) => pick(e, rm.id)}
            className={`room-item${sel === rm.id ? " on" : ""}`}
          >
            <span className="ri-av"><Icon name="network" /></span>
            <span className="ri-body">
              <b>Общий чат {rm.asyaPresent ? "· с Асей" : "· приватный"}</b>
              <span>{rm.last ? (rm.last.sender === "asya" ? "Ася: " : "") + rm.last.content : "Пусто — напиши первым"}</span>
            </span>
            {rm.unread > 0 ? <span className="ri-badge">{rm.unread > 9 ? "9+" : rm.unread}</span> : <span className="ri-go">›</span>}
          </a>
        ))}
        <a className="btn-primary rooms-cta" href="/account/network">Попросить Асю найти человека 🤍</a>
      </aside>

      <section className="rooms-pane">
        {sel ? (
          <RoomScreen key={sel} roomId={sel} embedded />
        ) : (
          <div className="rooms-pane-empty">
            <span className="rpe-ic"><Icon name="chat" /></span>
            <p>Выбери разговор слева</p>
          </div>
        )}
      </section>
    </div>
  );
}
