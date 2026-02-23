import { prisma } from "@/lib/prisma";
import type { ClubMatch, FootballTeam } from "@prisma/client";
import { SportsTickerClient } from "./SportsTickerClient";

export type MatchWithTeams = ClubMatch & {
  homeTeam: FootballTeam | null;
  awayTeam: FootballTeam | null;
};

export type TickerTeam = {
  label: string;
  upcoming: MatchWithTeams | null;
  result: MatchWithTeams | null;
};

const CLUB_TEAMS = [
  { key: "Herrer", label: "Herrer" },
  { key: "Damer", label: "Damer" },
  { key: "Herrer2", label: "Herrer 2" },
];

export async function SportsTicker() {
  const matches = await prisma.clubMatch
    .findMany({
      where: { enabled: true },
      include: { homeTeam: true, awayTeam: true },
    })
    .catch(() => []);

  const tickerTeams: TickerTeam[] = CLUB_TEAMS.map((ct) => ({
    label: ct.label,
    upcoming: matches.find((m) => m.clubTeam === ct.key && m.isUpcoming) ?? null,
    result: matches.find((m) => m.clubTeam === ct.key && !m.isUpcoming) ?? null,
  })).filter((t) => t.upcoming || t.result);

  if (tickerTeams.length === 0) return null;
  return <SportsTickerClient teams={tickerTeams} />;
}
