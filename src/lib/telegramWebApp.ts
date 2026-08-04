// Клиентский помощник для Telegram Mini App.
import { track } from "./track";
type TgWebApp = {
  initData?: string;
  ready?: () => void;
  expand?: () => void;
  setHeaderColor?: (c: string) => void;
  setBackgroundColor?: (c: string) => void;
};

const SDK = "https://telegram.org/js/telegram-web-app.js";

export function getTg(): TgWebApp | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp ?? null;
}

export function inTelegram(): boolean {
  const tg = getTg();
  return Boolean(tg && tg.initData);
}

// Гарантированно подгружает Telegram SDK (если ещё не загружен), не блокируя обычный веб.
function loadSdk(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof document === "undefined" || getTg()) return resolve();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    const existing = document.querySelector("script[data-tg-sdk]") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", finish, { once: true });
      setTimeout(finish, 1500);
      return;
    }
    const s = document.createElement("script");
    s.src = SDK;
    s.async = true;
    s.setAttribute("data-tg-sdk", "1");
    s.onload = finish;
    s.onerror = finish;
    document.head.appendChild(s);
    // Страховка: не виснем, если скрипт застрял (вне Telegram он всё равно не нужен).
    setTimeout(finish, 2500);
  });
}

// Инициализация Mini App + тихий вход по Telegram. Возвращает true, если мы внутри Telegram.
export async function initTelegramMiniApp(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  await loadSdk();
  const tg = getTg();
  // Вне Telegram initData пустой — сразу выходим, не задерживая обычный веб.
  if (!tg || !tg.initData) return false;
  try {
    tg.ready?.();
    tg.expand?.();
    tg.setHeaderColor?.("#181120");
    tg.setBackgroundColor?.("#181120");
  } catch {
    /* вне Telegram методов нет — не страшно */
  }
  try {
    const r = await fetch("/api/auth/tg-webapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData: tg.initData }),
    });
    // Тихий вход по Telegram — тоже «вход» в воронке (раньше login_done слался только с /login,
    // поэтому в админке «вошли» было 0, хотя Telegram-пользователи авторизованы). once — уникальные.
    if (r.ok) track("login_done", undefined, true);
  } catch {
    /* вход не удался — покажем обычный поток */
  }
  return true;
}
