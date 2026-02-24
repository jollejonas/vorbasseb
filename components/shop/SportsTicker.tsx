import { prisma } from "@/lib/prisma";
import type { DbuMatch, DbuStanding, FootballTeam } from "@prisma/client";
import { SportsTickerClient } from "./SportsTickerClient";

export type TickerMatch = Pick<
  DbuMatch,
  "matchDateTime" | "homeTeamName" | "homeScore" | "awayTeamName" | "awayScore" | "stadiumName"
>;

export type TickerStandingRow = Pick<
  DbuStanding,
  "sort" | "teamName" | "isClubTeam" | "point" | "noOfMatch" | "matchWon" | "matchDrawn" | "matchLost" | "score" | "scoreAgainst"
>;

export type TickerTeam = {
  label: string;
  league: string;
  result: TickerMatch | null;
  upcoming: TickerMatch | null;
  standingsSnippet: TickerStandingRow[];       // up to 3 rows: above, club, below
  homeLogo: string | null;
  awayLogo: string | null;
  upcomingHomeLogo: string | null;
  upcomingAwayLogo: string | null;
};

function findLogo(name: string, registry: FootballTeam[]): string | null {
  const lower = name.toLowerCase();
  const match = registry.find((t) => {
    const tl = t.name.toLowerCase();
    return lower.startsWith(tl) || tl.startsWith(lower) || lower.includes(tl) || tl.includes(lower);
  });
  return match?.logo ?? null;
}

export async function SportsTicker() {
  const now = new Date();

  const [configs, footballTeams] = await Promise.all([
    prisma.dbuTeamConfig
      .findMany({
        where: { enabled: true },
        include: {
          matches: { orderBy: { matchDateTime: "asc" } },
          standings: { orderBy: { sort: "asc" } },
        },
        orderBy: { createdAt: "asc" },
      })
      .catch(() => []),
    prisma.footballTeam.findMany().catch(() => []),
  ]);

  const tickerTeams: TickerTeam[] = configs
    .map((config) => {
      // Latest played result
      const result =
        config.matches
          .filter((m) => m.homeScore != null)
          .sort(
            (a, b) =>
              new Date(b.matchDateTime).getTime() - new Date(a.matchDateTime).getTime()
          )[0] ?? null;

      // Next upcoming match
      const upcoming =
        config.matches
          .filter((m) => m.homeScore == null && new Date(m.matchDateTime) > now)
          .sort(
            (a, b) =>
              new Date(a.matchDateTime).getTime() - new Date(b.matchDateTime).getTime()
          )[0] ?? null;

      // Standings snippet: always exactly 3 rows centred on club team.
      // If club is first, show positions 1–3. If last, show the bottom 3.
      const standings = config.standings; // already sorted by sort asc
      const clubIdx = standings.findIndex((s) => s.isClubTeam);
      const standingsSnippet: TickerStandingRow[] = (() => {
        if (clubIdx === -1 || standings.length === 0) return [];
        const total = standings.length;
        let start: number;
        if (clubIdx === 0) {
          start = 0; // first place → show 1st, 2nd, 3rd
        } else if (clubIdx === total - 1) {
          start = Math.max(0, total - 3); // last place → show 3rd-to-last … last
        } else {
          start = clubIdx - 1; // normal → 1 above, club, 1 below
        }
        return standings.slice(start, start + 3);
      })();

      return {
        label: config.label,
        league: config.standings[0]
          ? config.standings[0].teamName.match(/\(([^)]+)\)/)?.[1] ?? config.label
          : config.label,
        result,
        upcoming,
        standingsSnippet,
        homeLogo: result ? findLogo(result.homeTeamName, footballTeams) : null,
        awayLogo: result ? findLogo(result.awayTeamName, footballTeams) : null,
        upcomingHomeLogo: upcoming ? findLogo(upcoming.homeTeamName, footballTeams) : null,
        upcomingAwayLogo: upcoming ? findLogo(upcoming.awayTeamName, footballTeams) : null,
      };
    })
    .filter((t) => t.result || t.upcoming || t.standingsSnippet.length > 0);

  if (tickerTeams.length === 0) return null;
  return <SportsTickerClient teams={tickerTeams} />;
}
