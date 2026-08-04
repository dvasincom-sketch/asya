"use client";

import { useEffect, useState } from "react";
import { Orb } from "./Orb";
import { getTg, inTelegram, initTelegramMiniApp } from "@/lib/telegramWebApp";

// Шлюз авторизации для аккаунт-страниц.
// ГЛАВНЫЙ ПРИНЦИП: если мы внутри Telegram Mini App, человек УЖЕ авторизован своим ID —
// вход по телефону тут не нужен НИКОГДА. Если серверной сессии нет (база прогревалась
// после деплоя или моргнула, и createSession не прошёл) — настойчиво переавторизуемся
// по Telegram с ретраями, а не выкидываем на /login. На телефонный вход уводим ТОЛЬКО
// в настоящем вебе вне Telegram.

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function meHasUser(): Promise<boolean> {
  try {
    const d = await fetch("/api/me", { cache: "no-store" }).then((r) => r.json());
    return Boolean(d?.user);
  } catch {
    return false;
  }
}

async function tgAuthOnce(): Promise<void> {
  const tg = getTg();
  if (!tg?.initData) return;
  try {
    await fetch("/api/auth/tg-webapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData: tg.initData }),
    });
  } catch {
    /* сеть/база недоступны — снаружи ретрайнем */
  }
}

export default function AuthGate() {
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Загружаем SDK, инициализируем Mini App и делаем первый тихий вход по Telegram.
      // Race с таймаутом — чтобы вне Telegram (или если SDK застрял) экран НЕ висел на «узнаю тебя».
      const inTg = await Promise.race([
        initTelegramMiniApp().catch(() => false),
        new Promise<boolean>((r) => setTimeout(() => r(false), 3000)),
      ]);
      if (cancelled) return;

      if (!inTg && !inTelegram()) {
        // Настоящий веб вне Telegram — уводим на /login (там есть вход через Telegram и по телефону).
        window.location.href = "/login";
        return;
      }

      // Мы в Telegram. Проверяем, появилась ли сессия; если нет — ретраим вход
      // с нарастающей паузой (база могла ещё вставать после деплоя).
      let authed = await meHasUser();
      for (let attempt = 0; !authed && attempt < 4 && !cancelled; attempt++) {
        await sleep(1200 * (attempt + 1)); // 1.2с, 2.4с, 3.6с, 4.8с — покрывает прогрев БД
        if (cancelled) return;
        await tgAuthOnce();
        authed = await meHasUser();
      }
      if (cancelled) return;

      if (authed) {
        // Сессия есть — перезагружаем страницу, чтобы сервер отрисовал раздел.
        // Счётчик в URL (?_a=N) страхует от зацикливания; при новом переходе он сбрасывается сам.
        const url = new URL(window.location.href);
        const tries = Number(url.searchParams.get("_a") || "0");
        if (tries < 2) {
          url.searchParams.set("_a", String(tries + 1));
          window.location.replace(url.toString());
          return;
        }
      }
      // База долго недоступна или страница всё равно гейтит — не мучаем и НЕ шлём на телефон.
      setStuck(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="app">
      <div className="chat-loading">
        <Orb className="big-orb thinking" />
        {stuck ? (
          <>
            <p>Не получается восстановить связь. Обновим?</p>
            <button
              className="btn-primary"
              style={{ maxWidth: 240, margin: "12px auto 0" }}
              onClick={() => {
                const u = new URL(window.location.href);
                u.searchParams.delete("_a");
                window.location.replace(u.toString());
              }}
            >
              Обновить
            </button>
          </>
        ) : (
          <p>Секунду, узнаю тебя…</p>
        )}
      </div>
    </div>
  );
}
