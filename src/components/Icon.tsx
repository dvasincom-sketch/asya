// Минималистичные линейные иконки в стиле приложения (тонкая обводка, как глифы Таро).
// Цвет наследуется от currentColor — задаётся в CSS (акцент), работает в обеих темах.
import type { ReactNode } from "react";

export type IconName =
  | "memory" | "sessions" | "skills" | "health" | "network" | "settings" | "theme" | "plus" | "chat";

const PATHS: Record<IconName, ReactNode> = {
  // Сердце — «то, что Ася знает»
  memory: <path d="M12 20s-6.4-4.3-8.8-8.3C1.6 8.4 3.2 5.6 6.1 5.6c1.8 0 3.1 1.1 3.9 2.2.8-1.1 2.1-2.2 3.9-2.2 2.9 0 4.5 2.8 2.9 6.1C18.4 15.7 12 20 12 20Z" />,
  // Ручное зеркало — сессия/рефлексия
  sessions: (
    <>
      <ellipse cx="12" cy="9.5" rx="5.8" ry="6.6" />
      <path d="M12 16.1V21M8.6 21h6.8" />
    </>
  ),
  // Искры — навыки/роли
  skills: (
    <>
      <path d="M11 3c.5 4.3.9 4.7 5.2 5.2-4.3.5-4.7.9-5.2 5.2-.5-4.3-.9-4.7-5.2-5.2C10.1 7.7 10.5 7.3 11 3Z" />
      <path d="M17.6 13.5c.3 2 .5 2.2 2.5 2.5-2 .3-2.2.5-2.5 2.5-.3-2-.5-2.2-2.5-2.5 2-.3 2.2-.5 2.5-2.5Z" />
    </>
  ),
  // Пульс — здоровье
  health: <path d="M3 12h4l2-5 3 10 2-5h5" />,
  // Три связанных узла — сеть
  network: (
    <>
      <circle cx="6" cy="8" r="2.1" />
      <circle cx="18" cy="8" r="2.1" />
      <circle cx="12" cy="17" r="2.1" />
      <path d="M8 8h8M7.6 9.6l2.9 5.9M16.4 9.6l-2.9 5.9" />
    </>
  ),
  // Ползунки — настройки
  settings: (
    <>
      <path d="M4 8h9M17 8h3M4 16h3M11 16h9" />
      <circle cx="15" cy="8" r="2" />
      <circle cx="9" cy="16" r="2" />
    </>
  ),
  // Полукруг — день/вечер
  theme: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 0 0 16Z" fill="currentColor" stroke="none" />
    </>
  ),
  // Подарок — Забота+
  plus: (
    <>
      <path d="M4.5 10.5h15V20a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-9.5Z" />
      <path d="M3.5 7.5h17v3h-17zM12 7.5V21" />
      <path d="M12 7.5C9.8 7.5 8 6.4 8 5.2 8 4.3 8.8 4 9.4 4c1.6 0 2.6 2.3 2.6 3.5 0-1.2 1-3.5 2.6-3.5.6 0 1.4.3 1.4 1.2 0 1.2-1.8 2.3-4 2.3Z" />
    </>
  ),
  // Речь — чат
  chat: <path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />,
};

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      className={`ic ${className ?? ""}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
