"use client";

import { useRef, useState } from "react";
import { Orb } from "./Orb";

type Sheet = { title: string; text: string; btn: string; action: () => void };

const INITIAL_MEMORY = [
  "Любишь вечерний чай с ромашкой",
  "Устаёшь к пятнице на работе",
  "Кот Персик",
  "Тревожно перед созвонами",
];

export default function SettingsScreen() {
  const [chips, setChips] = useState<string[]>(INITIAL_MEMORY);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [toastMsg, setToastMsg] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function toggleTheme() {
    const el = document.documentElement;
    el.dataset.theme = el.dataset.theme === "day" ? "dusk" : "day";
  }

  function toast(msg: string) {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(""), 2600);
  }

  function removeChip(i: number) {
    setChips((c) => c.filter((_, idx) => idx !== i));
    toast("Ася это забыла 🤍");
  }

  function confirm(s: Sheet) {
    setSheet(s);
  }
  function runSheet() {
    if (sheet) sheet.action();
    setSheet(null);
  }

  return (
    <div className="app">
      <div className="sbar">
        <a className="icobtn" href="/account" title="назад">‹</a>
        <h1>Настройки и приватность</h1>
        <button className="icobtn right" onClick={toggleTheme} title="день / вечер">◐</button>
      </div>

      <div className="sbody">
        <div className="sec">Память Асей</div>
        <div className="scard">
          <div className="srow">
            <div className="ti">
              <b>Разрешить запоминать</b>
              <span>Ася будет помнить, что тебе важно, между разговорами</span>
            </div>
            <label className="switch">
              <input type="checkbox" defaultChecked />
              <span className="sl" />
            </label>
          </div>
          <div className="memwrap">
            <div className="mh">Вот что Ася помнит о тебе. Можешь убрать что угодно — она сразу забудет 🤍</div>
            <div className="chips">
              {chips.map((c, i) => (
                <span className="chip" key={c}>
                  {c}
                  <button onClick={() => removeChip(i)} aria-label="забыть">✕</button>
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="sec">Данные и история</div>
        <div className="scard">
          <div className="srow">
            <div className="ti">
              <b>Сохранять историю разговоров</b>
              <span>Хранится зашифрованно. Выключишь — переписка не сохраняется</span>
            </div>
            <label className="switch">
              <input type="checkbox" defaultChecked />
              <span className="sl" />
            </label>
          </div>
          <div className="srow tap" onClick={() => toast("Готовим файл с твоими данными… пришлём ссылку 🤍")}>
            <div className="ti">
              <b>Скачать мои данные</b>
              <span>Выгрузка всей переписки и памяти одним файлом</span>
            </div>
            <span className="rico">↓</span>
          </div>
        </div>

        <div className="sec">Удаление</div>
        <div className="scard">
          <div
            className="drow"
            onClick={() =>
              confirm({
                title: "Забыть память?",
                text: "Ася забудет всё, что знает о тебе. Ваши разговоры останутся, но она начнёт узнавать тебя заново.",
                btn: "Забыть память",
                action: () => { setChips([]); toast("Готово 🤍 Ася забыла, что знала о тебе"); },
              })
            }
          >
            <div className="di">🧠</div>
            <div className="dt"><b>Стереть память Асей</b><span>Она забудет всё о тебе, но сохранит переписку</span></div>
          </div>
          <div
            className="drow"
            onClick={() =>
              confirm({
                title: "Удалить всю историю?",
                text: "Все ваши разговоры будут удалены навсегда. Это нельзя отменить.",
                btn: "Удалить историю",
                action: () => toast("Готово 🤍 История разговоров удалена"),
              })
            }
          >
            <div className="di">🗑</div>
            <div className="dt"><b>Удалить всю историю — в один клик</b><span>Вся переписка стирается безвозвратно</span></div>
          </div>
          <div
            className="drow"
            onClick={() =>
              confirm({
                title: "Удалить аккаунт?",
                text: "Профиль, память и вся история будут удалены навсегда. Мне будет жаль прощаться, но выбор за тобой.",
                btn: "Удалить аккаунт",
                action: () => toast("Аккаунт удалён. Береги себя 🤍"),
              })
            }
          >
            <div className="di">🚪</div>
            <div className="dt"><b>Удалить аккаунт</b><span>Полностью удалить профиль и все данные</span></div>
          </div>
        </div>

        <div className="sec">Забота+</div>
        <div className="scard">
          <a className="srow tap" href="/account" style={{ textDecoration: "none" }}>
            <div className="ti">
              <b>Подписка активна</b>
              <span>300 ₽ / месяц · следующее списание 12 августа</span>
            </div>
            <span className="sub-badge">Управлять</span>
          </a>
          <div className="srow">
            <div className="ti">
              <b>Бережные напоминания</b>
              <span>Изредка «как ты сегодня?» — только с твоего согласия</span>
            </div>
            <label className="switch">
              <input type="checkbox" defaultChecked />
              <span className="sl" />
            </label>
          </div>
        </div>

        <div className="settings-foot">
          Ася — это поддержка и общение, не медицинская и не психологическая помощь.<br />
          <a href="#">Политика конфиденциальности</a> · <a href="#">Оферта</a>
        </div>
      </div>

      <div className={`overlay ${sheet ? "on" : ""}`} onClick={() => setSheet(null)} />
      <div className={`sheet ${sheet ? "on" : ""}`}>
        <Orb className="sh-orb" />
        <h3>{sheet?.title}</h3>
        <p>{sheet?.text}</p>
        <button className="sheet-btn danger" onClick={runSheet}>{sheet?.btn}</button>
        <button className="sheet-btn ghost" onClick={() => setSheet(null)}>Оставить как есть</button>
      </div>

      <div className={`toast ${toastMsg ? "on" : ""}`}>{toastMsg}</div>
    </div>
  );
}
