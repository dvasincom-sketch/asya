"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { LogoutButton } from "./LogoutButton";

type Overview = {
  user: { id: string; tgId: string | null; phone: string | null; name: string | null; avatarUrl: string | null; memberSince: string | null } | null;
  plan: { active: boolean; status: string | null; nextChargeAt: string | null; until: string | null; amount: string; configured: boolean; hasPaymentMethod: boolean };
  consent: { terms: { version: string | null; at: string | null }; health: { version: string | null; at: string | null }; records: { type: string; version: string; at: string }[] };
  legal: { version: string; updated: string; site: string; support: string };
};

function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  try { return new Date(s).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }); }
  catch { return "—"; }
}

const CONSENT_LABEL: Record<string, string> = {
  terms: "Пользовательское соглашение",
  privacy: "Политика конфиденциальности",
  offer: "Оферта «Забота+»",
  health: "Согласие на обработку медданных",
  network: "Согласие на «Сеть» — знакомства",
};

export default function ProfileScreen() {
  const [d, setD] = useState<Overview | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [refUrl, setRefUrl] = useState("");

  useEffect(() => {
    fetch("/api/account/overview").then((r) => r.json()).then(setD).catch(() => {});
  }, []);

  useEffect(() => {
    if (d?.user?.id && typeof window !== "undefined") {
      setRefUrl(`${window.location.origin}/?ref=${d.user.id.slice(0, 8)}`);
    }
  }, [d?.user?.id]);

  async function copyRef() {
    try { await navigator.clipboard.writeText(refUrl); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* no-op */ }
  }

  async function doDelete() {
    setDeleting(true);
    try {
      await fetch("/api/account", { method: "DELETE" });
      window.location.href = "/";
    } catch { setDeleting(false); }
  }

  const u = d?.user;
  const who = !u ? "" : u.tgId ? `Telegram · ${u.tgId}` : u.phone ? u.phone : u.id;
  const initial = (u?.name || "А").trim().charAt(0).toUpperCase();

  // Согласия: собираем из явных записей + флагов на пользователе.
  const consents: { key: string; at: string | null; version: string | null }[] = [];
  if (d) {
    if (d.consent.terms.at) consents.push({ key: "terms", at: d.consent.terms.at, version: d.consent.terms.version });
    if (d.consent.health.at) consents.push({ key: "health", at: d.consent.health.at, version: d.consent.health.version });
    for (const r of d.consent.records) if (!consents.some((c) => c.key === r.type)) consents.push({ key: r.type, at: r.at, version: r.version });
  }

  return (
    <div className="app auth prof">
      <div className="auth-card prof-card">
        <div className="prof-head">
          {u?.avatarUrl ? <img className="prof-av" src={u.avatarUrl} alt="" referrerPolicy="no-referrer" /> : <span className="prof-av letter">{initial}</span>}
          <div className="prof-id">
            <h2>{u?.name || "Твой профиль"}</h2>
            <div className="prof-who">{who}</div>
            {u?.memberSince && <div className="prof-since">С Асей с {fmtDate(u.memberSince)}</div>}
          </div>
        </div>

        <a className="btn-primary" href="/chat">Открыть чат с Асей</a>

        {/* Подписка и оплата */}
        <section className="prof-sec">
          <div className="prof-sec-h">Подписка и оплата</div>
          <div className="prof-box">
            {!d ? (
              <div className="prof-muted">Загружаю…</div>
            ) : d.plan.active ? (
              <>
                <div className="prof-row"><span>План</span><b>Забота+ · активна</b></div>
                <div className="prof-row"><span>Сумма</span><b>{d.plan.amount} ₽ / мес</b></div>
                <div className="prof-row"><span>{d.plan.status === "canceled" ? "Действует до" : "Следующее списание"}</span><b>{fmtDate(d.plan.nextChargeAt || d.plan.until)}</b></div>
                <div className="prof-row"><span>Способ оплаты</span><b>{d.plan.hasPaymentMethod ? "карта сохранена · ЮKassa" : "—"}</b></div>
                <a className="prof-link" href="/account/plus">Управлять подпиской ›</a>
              </>
            ) : (
              <>
                <div className="prof-row"><span>План</span><b>Бесплатный</b></div>
                <p className="prof-muted">Память и история живут ограниченный срок. В «Забота+» — бессрочно и полностью, {d.plan.amount} ₽ в месяц.</p>
                <a className="prof-link" href="/account/plus">Оформить «Забота+» ›</a>
              </>
            )}
          </div>
        </section>

        {/* Реферальная программа */}
        <section className="prof-sec">
          <div className="prof-sec-h">Пригласить подругу</div>
          <div className="prof-box">
            <p className="prof-muted">Поделись Асей с той, кому это сейчас важно. Твоя ссылка:</p>
            <div className="prof-ref">
              <input readOnly value={refUrl} onFocus={(e) => e.currentTarget.select()} />
              <button className="prof-copy" onClick={copyRef}>{copied ? "Скопировано ✓" : "Копировать"}</button>
            </div>
          </div>
        </section>

        {/* Настройки */}
        <a className="prof-tile" href="/account/settings">
          <span className="pt-ic"><Icon name="settings" /></span>
          <span className="pt-body"><b>Настройки и приватность</b><span>Память, история, темы, данные</span></span>
          <span className="pt-go">›</span>
        </a>

        {/* Документы и согласия */}
        <section className="prof-sec">
          <div className="prof-sec-h">Документы и согласия</div>
          <div className="prof-box">
            {consents.length > 0 ? consents.map((c) => (
              <div className="prof-row" key={c.key}>
                <span>{CONSENT_LABEL[c.key] || c.key}</span>
                <b className="prof-consent">принято {fmtDate(c.at)}</b>
              </div>
            )) : <div className="prof-muted">Согласия появятся здесь после онбординга.</div>}
            <div className="prof-docs">
              <a href="/terms" target="_blank" rel="noreferrer">Пользовательское соглашение</a>
              <a href="/privacy" target="_blank" rel="noreferrer">Политика конфиденциальности</a>
            </div>
            {d && <div className="prof-muted sm">Действующая редакция: {d.legal.updated}</div>}
          </div>
        </section>

        <LogoutButton />

        {/* Удаление аккаунта */}
        <section className="prof-sec">
          <div className="prof-sec-h danger">Удалить аккаунт</div>
          <div className="prof-box">
            {!confirmDel ? (
              <>
                <p className="prof-muted">Аккаунт уйдёт в архив. Полное удаление — через 30 дней. Если войдёшь снова в этот срок, всё вернётся.</p>
                <button className="prof-del" onClick={() => setConfirmDel(true)}>Удалить аккаунт</button>
              </>
            ) : (
              <>
                <p className="prof-muted">Точно? Разговоры, память и здоровье уйдут в архив на 30 дней, потом — насовсем.</p>
                <button className="prof-del solid" onClick={doDelete} disabled={deleting}>{deleting ? "Удаляю…" : "Да, в архив на 30 дней"}</button>
                <button className="prof-link" onClick={() => setConfirmDel(false)}>Отмена</button>
              </>
            )}
          </div>
        </section>

        <div className="auth-foot">Это общение и поддержка, не медицинская помощь 🌸</div>
      </div>
    </div>
  );
}
