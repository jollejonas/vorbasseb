"use client";

import { useState, useEffect } from "react";
import type { TickerTeam, TickerStandingRow } from "./SportsTicker";

function Logo({ src, name }: { src: string | null; name: string }) {
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={name} className="w-4 h-4 rounded-full object-cover shrink-0 inline-block" />
  );
}

function shortName(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

function formatDay(dt: Date | string): string {
  return new Intl.DateTimeFormat("da-DK", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
  }).format(new Date(dt));
}

function formatTime(dt: Date | string): string {
  return new Intl.DateTimeFormat("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dt));
}

function Sep() {
  return <span className="text-white/40 mx-1 self-stretch flex items-center">|</span>;
}

function StandingRows({ rows }: { rows: TickerStandingRow[] }) {
  return (
    <span className="flex flex-col gap-0.5">
      {rows.map((r) => (
        <span key={r.sort} className="flex items-center gap-1">
          <span className={r.isClubTeam ? "text-primary font-bold" : "text-white/65"}>
            {r.sort}. {shortName(r.teamName)}
          </span>
          <span className="text-white/40">({r.point}p)</span>
        </span>
      ))}
    </span>
  );
}

export function SportsTickerClient({ teams }: { teams: TickerTeam[] }) {
  const [teamIdx, setTeamIdx] = useState(0);

  useEffect(() => {
    if (teams.length <= 1) return;
    const id = setInterval(() => {
      setTeamIdx((i) => (i + 1) % teams.length);
    }, 8000);
    return () => clearInterval(id);
  }, [teams.length]);

  const t = teams[teamIdx];
  if (!t) return null;

  const hasResult = !!t.result;
  const hasUpcoming = !!t.upcoming;
  const hasStandings = t.standingsSnippet.length > 0;

  return (
    <div className="sticky top-16 z-40 bg-[#0a0f1e] border-b border-white/10 text-xs text-white py-2 px-4">
      <div className="max-w-6xl mx-auto flex items-center justify-center gap-2 flex-wrap">

        {/* Team label */}
        <span className="font-black text-primary uppercase tracking-widest shrink-0 text-[11px]">
          {t.label}
        </span>

        <Sep />

        {/* Latest result: teams on first line, venue below */}
        {hasResult && (
          <>
            <span className="flex flex-col items-center gap-0.5">
              <span className="flex items-center gap-1.5">
                <Logo src={t.homeLogo} name={t.result!.homeTeamName} />
                <span className="text-white/85">{shortName(t.result!.homeTeamName)}</span>
                <span className="font-bold text-white tabular-nums">
                  {t.result!.homeScore}–{t.result!.awayScore}
                </span>
                <Logo src={t.awayLogo} name={t.result!.awayTeamName} />
                <span className="text-white/85">{shortName(t.result!.awayTeamName)}</span>
              </span>
              {t.result!.stadiumName && (
                <span className="text-white/50">{t.result!.stadiumName}</span>
              )}
            </span>
            {(hasUpcoming || hasStandings) && <Sep />}
          </>
        )}

        {/* Next match: date on one line left, teams + venue centered on right */}
        {hasUpcoming && (
          <>
            <span className="flex items-center gap-2.5">
              {/* Date — single line, vertically centred */}
              <span className="text-white/65 shrink-0 whitespace-nowrap">
                {formatDay(t.upcoming!.matchDateTime)} {formatTime(t.upcoming!.matchDateTime)}
              </span>
              {/* Teams + venue — centred horizontally */}
              <span className="flex flex-col items-center gap-0.5 leading-tight">
                <span className="flex items-center gap-1.5">
                  <Logo src={t.upcomingHomeLogo} name={t.upcoming!.homeTeamName} />
                  <span className="text-white/85">{shortName(t.upcoming!.homeTeamName)}</span>
                  <span className="text-white/40 text-[10px]">vs</span>
                  <Logo src={t.upcomingAwayLogo} name={t.upcoming!.awayTeamName} />
                  <span className="text-white/85">{shortName(t.upcoming!.awayTeamName)}</span>
                </span>
                {t.upcoming!.stadiumName && (
                  <span className="text-white/50">{t.upcoming!.stadiumName}</span>
                )}
              </span>
            </span>
            {hasStandings && <Sep />}
          </>
        )}

        {/* Standings: 1 above · club · 1 below */}
        {hasStandings && <StandingRows rows={t.standingsSnippet} />}

        {/* Team dots (only if multiple teams) */}
        {teams.length > 1 && (
          <div className="flex gap-1 ml-2 shrink-0">
            {teams.map((team, i) => (
              <button
                key={i}
                onClick={() => setTeamIdx(i)}
                aria-label={`Vis ${team.label}`}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === teamIdx ? "bg-primary" : "bg-white/20 hover:bg-white/40"
                }`}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
