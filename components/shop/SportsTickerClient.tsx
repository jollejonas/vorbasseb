"use client";

import { useState, useEffect, useCallback } from "react";
import type { TickerTeam, TickerMatch, TickerStandingRow } from "./SportsTicker";

function Logo({ src, name }: { src: string | null; name: string }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={name} className="w-4 h-4 rounded-full object-cover shrink-0 inline-block" />
    );
  }
  return null;
}

function shortName(name: string): string {
  // Strip parenthetical suffix e.g. "Vorbasse B (S4 p. 91)" → "Vorbasse B"
  return name.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

function formatDate(dt: Date | string): string {
  return new Intl.DateTimeFormat("da-DK", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dt));
}

function ResultPanel({
  match,
  homeLogo,
  awayLogo,
}: {
  match: TickerMatch;
  homeLogo: string | null;
  awayLogo: string | null;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-white/40 text-[10px]">⚽</span>
      <Logo src={homeLogo} name={match.homeTeamName} />
      <span className="text-white/80">{shortName(match.homeTeamName)}</span>
      <span className="font-bold text-white tabular-nums px-0.5">
        {match.homeScore}–{match.awayScore}
      </span>
      <Logo src={awayLogo} name={match.awayTeamName} />
      <span className="text-white/80">{shortName(match.awayTeamName)}</span>
    </span>
  );
}

function UpcomingPanel({
  match,
  homeLogo,
  awayLogo,
}: {
  match: TickerMatch;
  homeLogo: string | null;
  awayLogo: string | null;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-white/40 text-[10px]">📅</span>
      <span className="text-white/60">{formatDate(match.matchDateTime)}</span>
      <span className="text-white/20">·</span>
      <Logo src={homeLogo} name={match.homeTeamName} />
      <span className="text-white/75">{shortName(match.homeTeamName)}</span>
      <span className="text-white/40 text-[10px]">vs</span>
      <Logo src={awayLogo} name={match.awayTeamName} />
      <span className="text-white/75">{shortName(match.awayTeamName)}</span>
      {match.stadiumName && (
        <>
          <span className="text-white/20">·</span>
          <span className="text-white/50">{match.stadiumName}</span>
        </>
      )}
    </span>
  );
}

function StandingsPanel({ rows }: { rows: TickerStandingRow[] }) {
  return (
    <span className="flex items-center gap-2">
      <span className="text-white/40 text-[10px]">📊</span>
      {rows.map((r) => (
        <span
          key={r.sort}
          className={r.isClubTeam ? "text-primary font-bold" : "text-white/60"}
        >
          {r.sort}. {shortName(r.teamName)}
          <span className="text-white/30 ml-1">({r.point}p)</span>
        </span>
      ))}
    </span>
  );
}

export function SportsTickerClient({ teams }: { teams: TickerTeam[] }) {
  // teamIdx = which team; panelIdx = which panel within that team (result/upcoming/standings)
  const [teamIdx, setTeamIdx] = useState(0);
  const [panelIdx, setPanelIdx] = useState(0);

  // Build panels for a team
  const getPanels = useCallback(
    (t: TickerTeam) => {
      const panels: React.ReactNode[] = [];
      if (t.result)
        panels.push(
          <ResultPanel match={t.result} homeLogo={t.homeLogo} awayLogo={t.awayLogo} />
        );
      if (t.upcoming)
        panels.push(
          <UpcomingPanel
            match={t.upcoming}
            homeLogo={t.upcomingHomeLogo}
            awayLogo={t.upcomingAwayLogo}
          />
        );
      if (t.standingsSnippet.length > 0)
        panels.push(<StandingsPanel rows={t.standingsSnippet} />);
      return panels;
    },
    []
  );

  useEffect(() => {
    const currentTeam = teams[teamIdx];
    if (!currentTeam) return;
    const panels = getPanels(currentTeam);

    const id = setInterval(() => {
      setPanelIdx((p) => {
        const next = p + 1;
        if (next >= panels.length) {
          // Move to next team, reset panel
          setTeamIdx((t) => (t + 1) % teams.length);
          return 0;
        }
        return next;
      });
    }, 4000);

    return () => clearInterval(id);
  }, [teamIdx, teams, getPanels]);

  const currentTeam = teams[teamIdx];
  if (!currentTeam) return null;
  const panels = getPanels(currentTeam);
  const currentPanel = panels[panelIdx] ?? panels[0];

  return (
    <div className="sticky top-16 z-40 bg-[#0a0f1e] border-b border-white/10 text-xs text-white py-2 px-4">
      <div className="max-w-6xl mx-auto flex items-center justify-center gap-3">
        {/* Team label */}
        <span className="font-black text-primary uppercase tracking-widest shrink-0 text-[11px]">
          {currentTeam.label}
        </span>

        <span className="text-white/20">|</span>

        {/* Current panel content */}
        <span className="flex items-center gap-1.5 flex-wrap justify-center">
          {currentPanel}
        </span>

        {/* Navigation dots — teams */}
        {teams.length > 1 && (
          <div className="flex gap-1 ml-2 shrink-0">
            {teams.map((t, i) => (
              <button
                key={i}
                onClick={() => { setTeamIdx(i); setPanelIdx(0); }}
                aria-label={`Vis ${t.label}`}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === teamIdx ? "bg-primary" : "bg-white/20 hover:bg-white/40"
                }`}
              />
            ))}
          </div>
        )}

        {/* Panel dots — sub-pages within a team */}
        {panels.length > 1 && (
          <div className="flex gap-0.5 shrink-0">
            {panels.map((_, i) => (
              <button
                key={i}
                onClick={() => setPanelIdx(i)}
                className={`w-1 h-1 rounded-full transition-colors ${
                  i === panelIdx ? "bg-white/70" : "bg-white/15"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
