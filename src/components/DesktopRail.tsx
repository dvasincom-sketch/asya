"use client";

// Десктоп-оболочка: левый навигационный рэйл. Показывается только на app-маршрутах
// (чат и кабинет) и только на широком экране (≥1024px, включается CSS по [data-rail]).
// Мобильный Telegram Mini App этим компонентом не затрагивается.
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Orb } from "@/components/Orb";
import { Icon, type IconName } from "@/components/Icon";

const NAV: { href: string; ic: IconName; t: string; on: (p: string) => boolean }[] = [
  { href: "/chat", ic: "chat", t: "Чат с Асей", on: (p) => p === "/chat" },
  { href: "/rooms", ic: "network", t: "Румы", on: (p) => p.startsWith("/rooms") },
  { href: "/account/calls", ic: "calls", t: "Звонки", on: (p) => p.startsWith("/account/calls") },
  { href: "/account/sessions", ic: "sessions", t: "Сессии", on: (p) => p.startsWith("/account/sessions") },
  { href: "/account/health", ic: "health", t: "Здоровье", on: (p) => p.startsWith("/account/health") },
  { href: "/account/skills", ic: "skills", t: "Навыки", on: (p) => p.startsWith("/account/skills") },
  { href: "/account/network", ic: "network", t: "Сеть", on: (p) => p.startsWith("/account/network") },
  { href: "/account/memory", ic: "memory", t: "Ася знает", on: (p) => p.startsWith("/account/memory") },
  { href: "/account/plus", ic: "plus", t: "Забота+", on: (p) => p.startsWith("/account/plus") },
];

function isAppRoute(p: string): boolean {
  return p === "/chat" || p.startsWith("/rooms") || p === "/account" || p.startsWith("/account/");
}

export default function DesktopRail() {
  const pathname = usePathname() || "";
  const show = isAppRoute(pathname);
  const [me, setMe] = useState<{ name: string | null; avatarUrl: string | null }>({ name: null, avatarUrl: null });
  const [callsUnread, setCallsUnread] = useState(0);

  // Включаем сдвиг контента под рэйл только на app-маршрутах (CSS смотрит на data-rail).
  useEffect(() => {
    const root = document.documentElement;
    if (show) root.setAttribute("data-rail", "1");
    else root.removeAttribute("data-rail");
    return () => root.removeAttribute("data-rail");
  }, [show]);

  useEffect(() => {
    if (!show) return;
    let alive = true;
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => { if (alive && d?.user) setMe({ name: d.user.name ?? null, avatarUrl: d.user.avatarUrl ?? null }); })
      .catch(() => {});
    return () => { alive = false; };
  }, [show]);

  useEffect(() => {
    if (!show) return;
    let alive = true;
    fetch("/api/calls").then((r) => r.json()).then((d) => { if (alive) setCallsUnread(Number(d?.unread) || 0); }).catch(() => {});
    return () => { alive = false; };
  }, [show, pathname]);

  function toggleTheme() {
    const el = document.documentElement;
    el.dataset.theme = el.dataset.theme === "day" ? "dusk" : "day";
  }

  if (!show) return null;

  return (
    <aside className="drail" aria-label="Навигация">
      <a className="drail-brand" href="/chat">
        <Orb className="drail-orb" />
        <span>Ася</span>
      </a>
      <nav className="drail-nav">
        {NAV.map((n) => (
          <a key={n.href} href={n.href} className={`drail-item${n.on(pathname) ? " on" : ""}`}>
            <span className="drail-ic"><Icon name={n.ic} /></span>
            <span className="drail-t">{n.t}</span>
            {n.href === "/account/calls" && callsUnread > 0 ? <span className="drail-badge">{callsUnread > 9 ? "9+" : callsUnread}</span> : null}
          </a>
        ))}
      </nav>
      <div className="drail-foot">
        <button className="drail-theme" onClick={toggleTheme} title="Сменить тему" aria-label="сменить тему">
          <Icon name="theme" />
        </button>
        <a className="drail-me" href="/account" title="Личный кабинет">
          {me.avatarUrl ? (
            <img src={me.avatarUrl} alt="" referrerPolicy="no-referrer" />
          ) : me.name ? (
            <span className="drail-me-ltr">{me.name.trim().charAt(0).toUpperCase()}</span>
          ) : (
            <span className="drail-me-ltr">А</span>
          )}
          <span className="drail-me-t">{me.name || "Кабинет"}</span>
        </a>
      </div>
    </aside>
  );
}
