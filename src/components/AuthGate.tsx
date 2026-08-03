"use client";

import { useEffect } from "react";
import { Orb } from "./Orb";
import { initTelegramMiniApp } from "@/lib/telegramWebApp";

// Шлюз авторизации для аккаунт-страниц.
// В Telegram-мини-аппе тихо переавторизуется и перезагружается (сессия появляется),
// и только если это реально веб вне Telegram (или повтор не помог) — уводит на /login.
// Так пользователь Telegram больше не упирается во вход по телефону,
// и короткая недоступность базы после деплоя не выбрасывает из кабинета.
export default function AuthGate() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const tried = url.searchParams.get("_a") === "1";
    let cancelled = false;
    (async () => {
      const inTg = await initTelegramMiniApp().catch(() => false);
      if (cancelled) return;
      if (inTg && !tried) {
        // Один повтор: после перезагрузки сессия уже есть, страница отрисуется.
        url.searchParams.set("_a", "1");
        window.location.replace(url.toString());
        return;
      }
      window.location.href = "/login";
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="app">
      <div className="chat-loading">
        <Orb className="big-orb thinking" />
        <p>Секунду, узнаю тебя…</p>
      </div>
    </div>
  );
}
