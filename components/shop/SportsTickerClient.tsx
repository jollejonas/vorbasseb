"use client";

import { useState, useEffect } from "react";
import type { TickerTeam, MatchWithTeams } from "./SportsTicker";

function TeamLogo({ logo, name }: { logo: string | null; name: string }) {
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo}
        alt={name}
        className="w-4 h-4 rounded-full object-cover inline-block shrink-0"
      />
    );
  }
  return (
    <span className="w-4 h-4 rounded-full bg-white/20 inline-flex items-center justify-center text-[8px] font-bold shrink-0">
      {name.charAt(0)}
    </span>
  );
}

function formatDate(date: Date | string | null): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("da-DK", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function ResultSegment({ match }: { match: MatchWithTeams }) {
  const home = match.homeTeam;
  const away = match.awayTeam;
  const hasScore = match.homeScore != null && match.awayScore != null;

  return (
    <span className="flex items-center gap-1 text-white/80">
      <span>⚽</span>
      {home && <TeamLogo logo={home.logo ?? null} name={home.name} />}
      <span>{home?.name ?? "?"}</span>
      {hasScore && (
        <span className="font-bold text-white px-1">
          {match.homeScore}–{match.awayScore}
        </span>
      )}
      {away && <TeamLogo logo={away.logo ?? null} name={away.name} />}
      <span>{away?.name ?? "?"}</span>
    </span>
  );
}

function UpcomingSegment({ match }: { match: MatchWithTeams }) {
  const home = match.homeTeam;
  const away = match.awayTeam;

  return (
    <span className="flex items-center gap-1 text-white/60">
      <span>📅</span>
      {match.matchDate && (
        <span className="text-white/70">{formatDate(match.matchDate)}</span>
      )}
      {home && <TeamLogo logo={home.logo ?? null} name={home.name} />}
      <span>{home?.name ?? "?"}</span>
      <span className="text-white/40">vs</span>
      {away && <TeamLogo logo={away.logo ?? null} name={away.name} />}
      <span>{away?.name ?? "?"}</span>
      {match.venue && (
        <>
          <span className="text-white/30">·</span>
          <span className="text-white/50">{match.venue}</span>
        </>
      )}
    </span>
  );
}

export function SportsTickerClient({ teams }: { teams: TickerTeam[] }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (teams.length <= 1) return;
    const id = setInterval(() => setCurrent((i) => (i + 1) % teams.length), 5000);
    return () => clearInterval(id);
  }, [teams.length]);

  const team = teams[current];

  return (
    <div className="sticky top-16 z-40 bg-[#0a0f1e] border-b border-white/10 text-xs text-white py-2 px-4">
      <div className="max-w-6xl mx-auto flex items-center justify-center gap-3 flex-wrap">
        {/* Team label */}
        <span className="font-bold text-primary uppercase tracking-wide shrink-0">
          {team.label}
        </span>

        {/* League */}
        {(team.result?.league || team.upcoming?.league) && (
          <span className="text-white/40 text-[10px] uppercase tracking-wide shrink-0">
            {team.result?.league || team.upcoming?.league}
          </span>
        )}

        {/* Result */}
        {team.result && <ResultSegment match={team.result} />}

        {/* Separator */}
        {team.result && team.upcoming && (
          <span className="text-white/20">|</span>
        )}

        {/* Upcoming */}
        {team.upcoming && <UpcomingSegment match={team.upcoming} />}

        {/* Team dots */}
        {teams.length > 1 && (
          <div className="flex gap-1 ml-2 shrink-0">
            {teams.map((t, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                aria-label={`Vis ${t.label}`}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === current ? "bg-primary" : "bg-white/25 hover:bg-white/50"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
