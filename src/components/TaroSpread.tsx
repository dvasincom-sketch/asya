"use client";

import { getCard } from "@/lib/tarot";
import { clean } from "@/lib/text";

// Отдельная сцена расклада: карты выкладываются по позициям и переворачиваются,
// снизу — толкование Аси. Не сообщение в чате, а ритуал.
const POSITIONS: Record<number, string[]> = {
  3: ["Прошлое", "Настоящее", "Будущее"],
};

export default function TaroSpread({
  cards,
  text,
  onClose,
}: {
  cards: string[];
  text: string;
  onClose: () => void;
}) {
  const list = cards.map((id) => getCard(id)).filter((c): c is NonNullable<ReturnType<typeof getCard>> => Boolean(c));
  const labels = POSITIONS[list.length] || [];
  const title = list.length === 3 ? "Прошлое · Настоящее · Будущее" : "Твоя карта";

  return (
    <div className="taro-scene">
      <div className="taro-scene-top">
        <button className="icobtn" onClick={onClose} aria-label="закрыть">✕</button>
      </div>
      <div className={`taro-scene-body${text ? " revealed" : ""}`}>
        <div className="taro-title">{title}</div>

        <div className={`taro-spread n${list.length}`}>
          {list.map((c, i) => (
            <div className="taro-slot" key={c.id + i}>
              <div className="taro-card2">
                <div className="taro-inner2" style={{ animationDelay: `${0.15 + i * 0.28}s` }}>
                  <div className="taro-back2"><span className="taro-mono">А</span></div>
                  <div className="taro-face2">
                    <div className="taro-num">{c.num}</div>
                    <svg className="taro-glyph" viewBox="0 0 100 100" dangerouslySetInnerHTML={{ __html: c.glyph }} />
                    <div className="taro-name2">{c.ru}</div>
                  </div>
                </div>
              </div>
              {labels[i] ? <div className="taro-pos">{labels[i]}</div> : null}
            </div>
          ))}
        </div>

        {text ? (
          <div className="taro-reading">{clean(text)}</div>
        ) : (
          <div className="taro-reading dim">
            <span className="typing" style={{ display: "inline-flex" }}><i /><i /><i /></span>
            <div style={{ marginTop: 8 }}>Ася смотрит на карты…</div>
          </div>
        )}

        <button className="btn-ghost taro-close" onClick={onClose}>Закрыть расклад</button>
      </div>
    </div>
  );
}
