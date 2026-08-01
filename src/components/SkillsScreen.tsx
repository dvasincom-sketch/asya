"use client";

import { useEffect, useState } from "react";
import { Orb } from "./Orb";
import { track } from "@/lib/track";

type Skill = { id: string; title: string; icon: string; blurb: string; starters: string[] };

export default function SkillsScreen() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    track("skills_open", undefined, true);
    fetch("/api/skills")
      .then((r) => r.json())
      .then((d) => setSkills(Array.isArray(d.skills) ? d.skills : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function open(id: string) {
    track("skill_start", id);
    window.location.href = `/chat?skill=${encodeURIComponent(id)}`;
  }

  return (
    <div className="app">
      <div className="sbar">
        <a className="icobtn" href="/account" title="назад">‹</a>
        <h1>Навыки</h1>
      </div>

      <div className="sbody">
        <div className="setup-intro">
          <Orb className="s-orb" />
          <h2>Асе можно дать навык</h2>
          <p>
            Выбери роль — и я переключусь в неё: буду держаться темы, опираться на проверенное и не фантазировать.
            Обычный тёплый чат остаётся отдельно.
          </p>
        </div>

        <div className="grp">Готовые навыки</div>
        {skills.map((s) => (
          <button className="opt" key={s.id} onClick={() => open(s.id)}>
            <span className="o-ic">{s.icon}</span>
            <div>
              <b>{s.title}</b>
              <span>{s.blurb}</span>
            </div>
          </button>
        ))}
        {loading && !skills.length && <div className="d-summary">Загружаю навыки…</div>}

        <div className="hnote">
          Навыки — это про заботу и общение, а не медицинская, психологическая или иная профессиональная помощь.
          Важные решения принимай с живым специалистом.
        </div>
      </div>
    </div>
  );
}
