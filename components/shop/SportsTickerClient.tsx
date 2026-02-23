"use client";

import { useState, useEffect } from "react";

type Team = { label: string; result: string; next: string };

export function SportsTickerClient({ teams }: { teams: Team[] }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (teams.length <= 1) return;
    const id = setInterval(() => setCurrent((i) => (i + 1) % teams.length), 4000);
    return () => clearInterval(id);
  }, [teams.length]);

  const team = teams[current];

  return (
    <div className="sticky top-16 z-40 bg-[#0a0f1e] border-b border-white/10 text-xs text-white py-1.5 px-4 flex items-center justify-center gap-3 flex-wrap">
      <span className="font-bold text-primary uppercase tracking-wide">
        {team.label}
      </span>
      {team.result && (
        <span className="text-white/80">⚽ {team.result}</span>
      )}
      {team.result && team.next && (
        <span className="text-white/30">·</span>
      )}
      {team.next && (
        <span className="text-white/60">📅 {team.next}</span>
      )}
      {teams.length > 1 && (
        <div className="flex gap-1 ml-1">
          {teams.map((t, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              aria-label={`Vis ${t.label}`}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                i === current
                  ? "bg-primary"
                  : "bg-white/25 hover:bg-white/50"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
