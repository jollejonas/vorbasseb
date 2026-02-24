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

      // Standings snippet: club row ± 1
      const clubRow = config.standings.find((s) => s.isClubTeam);
      const standingsSnippet: TickerStandingRow[] = clubRow
        ? config.standings.filter(
            (s) => s.sort >= clubRow.sort - 1 && s.sort <= clubRow.sort + 1
          )
        : [];

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
