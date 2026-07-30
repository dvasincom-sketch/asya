"use client";

// Одно меню вместо россыпи иконок в шапке: разделы + смена темы.
const ITEMS = [
  { href: "/account/memory", ic: "🤍", title: "То, что Ася о тебе знает", sub: "Портрет, темы и сохранённые разборы" },
  { href: "/account/sessions", ic: "🪞", title: "Сессия с Асей", sub: "Разобрать идею, подвести итоги, понять себя" },
  { href: "/account/health", ic: "🩺", title: "Здоровье", sub: "Анализы, динамика и напоминания" },
  { href: "/account/settings", ic: "⚙️", title: "Настройки и приватность", sub: "Память, история, удаление данных" },
];

export default function MenuSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
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
            <span className="mi-ic">{i.ic}</span>
            <span className="mi-body">
              <b>{i.title}</b>
              <span>{i.sub}</span>
            </span>
            <span className="mi-go">›</span>
          </a>
        ))}

        <button className="menu-item" onClick={toggleTheme}>
          <span className="mi-ic">◐</span>
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
