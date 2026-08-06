"use client";

import { Icon, type IconName } from "./Icon";

// Одно меню вместо россыпи иконок в шапке: разделы + смена темы.
const ITEMS = [
  { href: "/account/memory", ic: "memory" as IconName, title: "То, что Ася о тебе знает", sub: "Портрет, темы и сохранённые разборы" },
  { href: "/account/sessions", ic: "sessions" as IconName, title: "Сессия с Асей", sub: "Разобрать идею, подвести итоги, понять себя" },
  { href: "/account/skills", ic: "skills" as IconName, title: "Навыки", sub: "Нутрициолог, астролог и другие роли Асей" },
  { href: "/account/health", ic: "health" as IconName, title: "Здоровье", sub: "Анализы, динамика и напоминания" },
  { href: "/account/network", ic: "network" as IconName, title: "Сеть", sub: "Ася знакомит по согласию и берёт рутину на себя" },
  { href: "/account/calls", ic: "calls" as IconName, title: "Звонки", sub: "Кого приняла Ася, пока тебя не было" },
  { href: "/account/settings", ic: "settings" as IconName, title: "Настройки и приватность", sub: "Память, история, удаление данных" },
];

export default function MenuSheet({ open, onClose, netCount = 0 }: { open: boolean; onClose: () => void; netCount?: number }) {
  function toggleTheme() {
    const el = document.documentElement;
    el.dataset.theme = el.dataset.theme === "day" ? "dusk" : "day";
  }

  return (
    <>
      <div className={`overlay ${open ? "on" : ""}`} onClick={onClose} />
      <div className={`sheet menu-sheet ${open ? "on" : ""}`} role="menu" aria-hidden={!open}>
        <div className="menu-grip" />
        {ITEMS.map((i) => (
          <a className="menu-item" href={i.href} key={i.href}>
            <span className="mi-ic"><Icon name={i.ic} /></span>
            <span className="mi-body">
              <b>{i.title}</b>
              <span>{i.sub}</span>
            </span>
            {i.href === "/account/network" && netCount > 0
              ? <span className="mi-badge">{netCount > 9 ? "9+" : netCount}</span>
              : <span className="mi-go">›</span>}
          </a>
        ))}

        <button className="menu-item" onClick={toggleTheme}>
          <span className="mi-ic"><Icon name="theme" /></span>
          <span className="mi-body">
            <b>День или вечер</b>
            <span>Переключить тему оформления</span>
          </span>
        </button>

        <button className="sheet-btn ghost" onClick={onClose}>Закрыть</button>
      </div>
    </>
  );
}
