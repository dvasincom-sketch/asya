"use client";

import { getCard } from "@/lib/tarot";

// Карты Таро в стиле Аси: рубашка-«орб» переворачивается в лицо (стекло + линейный глиф).
export default function TaroCards({ cards }: { cards: string[] }) {
  const list = cards.map((id) => getCard(id)).filter((c): c is NonNullable<ReturnType<typeof getCard>> => Boolean(c));
  if (!list.length) return null;
  return (
    <div className="taro-row">
      {list.map((c, i) => (
        <div className="taro-card" key={c.id + i}>
          <div className="taro-inner" style={{ animationDelay: `${i * 0.16}s` }}>
            <div className="taro-back">
              <span className="taro-mono">А</span>
            </div>
            <div className="taro-face">
              <div className="taro-num">{c.num}</div>
              <svg className="taro-glyph" viewBox="0 0 100 100" dangerouslySetInnerHTML={{ __html: c.glyph }} />
              <div className="taro-name">
                <b>{c.ru}</b>
                <span>{c.en}</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
