"use client";

import { useEffect, useRef, useState } from "react";
import { Orb } from "./Orb";
import { forgetAllIncKeys } from "@/lib/incognito";

type Sheet = { title: string; text: string; btn: string; action: () => void | Promise<void> };
type Chip = { id: string; fact: string };

export default function SettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [historyEnabled, setHistoryEnabled] = useState(true);
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [reminderCadence, setReminderCadence] = useState("rare");
  const [healthEnabled, setHealthEnabled] = useState(false);
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
        setReminderCadence(d.user.reminderCadence || "rare");
        setHealthEnabled(Boolean(d.user.healthEnabled));
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
  function onCadence(v: string) {
    setReminderCadence(v);
    fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reminderCadence: v }),
    }).catch(() => {});
    toast("Готово 🤍 Ася учтёт");
  }

  // Медданные — особая категория: своё согласие и своё удаление.
  function onHealth(v: boolean) {
    setHealthEnabled(v);
    fetch("/api/health/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(v ? { confirm: true } : { enabled: false }),
    }).catch(() => {});
    toast(v ? "Ася снова собирает историю здоровья 🤍" : "Новые медицинские документы не собираются");
  }

  async function wipeHealth() {
    await fetch("/api/health/data", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    }).catch(() => {});
    toast("Готово 🤍 Все медицинские данные удалены");
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

  async function wipePrivate() {
    forgetAllIncKeys();
    await fetch("/api/private", { method: "DELETE" }).catch(() => {});
    toast("Готово 🤍 Приватные записи удалены");
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

        <div className="sec">Здоровье</div>
        <div className="scard">
          <div className="srow">
            <div className="ti">
              <b>Собирать историю здоровья</b>
              <span>Анализы и заключения — особая категория данных, поэтому согласие отдельное</span>
            </div>
            <label className="switch">
              <input type="checkbox" checked={healthEnabled} onChange={(e) => onHealth(e.target.checked)} />
              <span className="sl" />
            </label>
          </div>
          <a className="srow tap" href="/account/health" style={{ textDecoration: "none" }}>
            <div className="ti">
              <b>Мои документы и показатели</b>
              <span>История анализов, динамика и напоминания</span>
            </div>
            <span className="rico">›</span>
          </a>
          <div
            className="drow"
            onClick={() =>
              confirm({
                title: "Удалить медицинские данные?",
                text: "Все документы, показатели и напоминания о здоровье будут удалены навсегда. Остальная переписка и память останутся.",
                btn: "Удалить медданные",
                action: wipeHealth,
              })
            }
          >
            <div className="di">🩺</div>
            <div className="dt"><b>Удалить все медицинские данные</b><span>Отдельно от остального — в один клик</span></div>
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
                title: "Стереть приватные записи?",
                text: "Все инкогнито-разговоры на сервере будут удалены, а ключ шифрования на этом устройстве — забыт. Обычная переписка и память останутся.",
                btn: "Стереть приватные записи",
                action: wipePrivate,
              })
            }
          >
            <div className="di">🕶️</div>
            <div className="dt"><b>Стереть приватные записи</b><span>Инкогнито-разговоры и ключ этого устройства</span></div>
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
          <a className="srow tap" href="/account/plus" style={{ textDecoration: "none" }}>
            <div className="ti">
              <b>Забота+</b>
              <span>Хранение истории и памяти · 300 ₽ / месяц</span>
            </div>
            <span className="sub-badge">Управлять</span>
          </a>
          <div className="srow">
            <div className="ti">
              <b>Бережные напоминания</b>
              <span>Ася иногда сама напишет первой в Telegram — тепло и без давления</span>
            </div>
            <label className="switch">
              <input type="checkbox" checked={remindersEnabled} onChange={(e) => onReminders(e.target.checked)} />
              <span className="sl" />
            </label>
          </div>
          {remindersEnabled && (
            <div className="srow" style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
              <div className="ti">
                <b>Как часто писать первой</b>
                <span>Не чаще выбранного и только когда тебя какое-то время не было</span>
              </div>
              <div className="stat-tabs" style={{ margin: 0 }}>
                {[
                  { id: "rare", label: "Изредка" },
                  { id: "weekly", label: "Раз в неделю" },
                  { id: "often", label: "Почаще" },
                ].map((o) => (
                  <button
                    key={o.id}
                    className={`opt-tab ${reminderCadence === o.id ? "on" : ""}`}
                    onClick={() => onCadence(o.id)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          )}
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
