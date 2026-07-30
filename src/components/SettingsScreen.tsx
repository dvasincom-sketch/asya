"use client";

import { useEffect, useRef, useState } from "react";
import { Orb } from "./Orb";

type Sheet = { title: string; text: string; btn: string; action: () => void | Promise<void> };
type Chip = { id: string; fact: string };

export default function SettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [historyEnabled, setHistoryEnabled] = useState(true);
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [chips, setChips] = useState<Chip[]>([]);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [toastMsg, setToastMsg] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Загрузка реальных настроек и памяти.
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (!d.user) {
          window.location.href = "/login";
          return;
        }
        setMemoryEnabled(Boolean(d.user.memoryEnabled));
        setHistoryEnabled(Boolean(d.user.historyEnabled));
        setRemindersEnabled(Boolean(d.user.remindersEnabled));
        setChips(Array.isArray(d.memories) ? d.memories : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function toggleTheme() {
    const el = document.documentElement;
    el.dataset.theme = el.dataset.theme === "day" ? "dusk" : "day";
  }

  function toast(msg: string) {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(""), 2600);
  }

  // Оптимистичное обновление флага + сохранение на сервере.
  function saveFlag(patch: Partial<{ memoryEnabled: boolean; historyEnabled: boolean; remindersEnabled: boolean }>) {
    fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => {});
  }

  function onMemory(v: boolean) {
    setMemoryEnabled(v);
    saveFlag({ memoryEnabled: v });
    toast(v ? "Ася снова запоминает 🤍" : "Ася больше не будет запоминать");
  }
  function onHistory(v: boolean) {
    setHistoryEnabled(v);
    saveFlag({ historyEnabled: v });
    toast(v ? "История сохраняется 🤍" : "Новые разговоры не сохраняются");
  }
  function onReminders(v: boolean) {
    setRemindersEnabled(v);
    saveFlag({ remindersEnabled: v });
  }

  function removeChip(id: string) {
    setChips((c) => c.filter((x) => x.id !== id));
    fetch("/api/memory", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {});
    toast("Ася это забыла 🤍");
  }

  async function wipeMemory() {
    setChips([]);
    await fetch("/api/memory", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    }).catch(() => {});
    toast("Готово 🤍 Ася забыла, что знала о тебе");
  }

  async function wipeHistory() {
    await fetch("/api/history", { method: "DELETE" }).catch(() => {});
    toast("Готово 🤍 История разговоров удалена");
  }

  async function deleteAccount() {
    await fetch("/api/account", { method: "DELETE" }).catch(() => {});
    window.location.href = "/";
  }

  function confirm(s: Sheet) {
    setSheet(s);
  }
  async function runSheet() {
    const s = sheet;
    setSheet(null);
    if (s) await s.action();
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
              <input type="checkbox" checked={memoryEnabled} onChange={(e) => onMemory(e.target.checked)} />
              <span className="sl" />
            </label>
          </div>
          <div className="memwrap">
            <div className="mh">
              {chips.length
                ? "Вот что Ася помнит о тебе. Можешь убрать что угодно — она сразу забудет 🤍"
                : loading
                  ? "Загружаю…"
                  : "Пока Ася ничего не запомнила. Она понемногу узнаёт тебя по мере ваших разговоров 🤍"}
            </div>
            {chips.length > 0 && (
              <div className="chips">
                {chips.map((c) => (
                  <span className="chip" key={c.id}>
                    {c.fact}
                    <button onClick={() => removeChip(c.id)} aria-label="забыть">✕</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="sec">Данные и история</div>
        <div className="scard">
          <div className="srow">
            <div className="ti">
              <b>Сохранять историю разговоров</b>
              <span>Выключишь — новые разговоры не сохраняются</span>
            </div>
            <label className="switch">
              <input type="checkbox" checked={historyEnabled} onChange={(e) => onHistory(e.target.checked)} />
              <span className="sl" />
            </label>
          </div>
          <a className="srow tap" href="/api/export" style={{ textDecoration: "none" }}>
            <div className="ti">
              <b>Скачать мои данные</b>
              <span>Выгрузка всей переписки и памяти одним файлом</span>
            </div>
            <span className="rico">↓</span>
          </a>
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
                action: wipeMemory,
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
                action: wipeHistory,
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
                action: deleteAccount,
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
              <b>Забота+</b>
              <span>Хранение истории и памяти · 300 ₽ / месяц</span>
            </div>
            <span className="sub-badge">Управлять</span>
          </a>
          <div className="srow">
            <div className="ti">
              <b>Бережные напоминания</b>
              <span>Изредка «как ты сегодня?» — только с твоего согласия</span>
            </div>
            <label className="switch">
              <input type="checkbox" checked={remindersEnabled} onChange={(e) => onReminders(e.target.checked)} />
              <span className="sl" />
            </label>
          </div>
        </div>

        <div className="settings-foot">
          Ася — это поддержка и общение, не медицинская и не психологическая помощь.<br />
          <a href="/privacy">Политика конфиденциальности</a> · <a href="/terms">Оферта</a>
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
