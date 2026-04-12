import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { dbuGetTeams, dbuGetMatches, dbuGetStandings, deriveLabel, parseDbuDateTime } from "@/lib/dbu";

// Shared sync logic — used by admin route and cron route
export async function runDiscover() {
  const teams = await dbuGetTeams();
  const configs = [];

  for (const t of teams) {
    if (!t.Pool) continue;
    const config = await prisma.dbuTeamConfig.upsert({
      where: { teamId_poolId: { teamId: t.TeamId, poolId: t.Pool.PoolId } },
      create: {
        teamId: t.TeamId,
        poolId: t.Pool.PoolId,
        rowName: t.Pool.RowName,
        label: deriveLabel(t.Pool.RowName),
        enabled: true,
      },
      update: {
        // Only update rowName — preserve admin-edited label and enabled state
        rowName: t.Pool.RowName,
      },
    });
    configs.push(config);
  }

  return configs;
}

export async function runDataSync() {
  const configs = await prisma.dbuTeamConfig.findMany({ where: { enabled: true } });
  const now = new Date();

  for (const config of configs) {
    try {
      // Sync matches
      const matchData = await dbuGetMatches(config.poolId, config.teamId);
      for (const m of matchData.MatchList) {
        await prisma.dbuMatch.upsert({
          where: { dbuId: m.Id },
          create: {
            dbuId: m.Id,
            configId: config.id,
            matchDateTime: parseDbuDateTime(m.MatchDateTime),
            roundNo: m.RoundNo,
            homeTeamName: m.HomeTeamName,
            homeScore: m.HomeTeamScore,
            awayTeamName: m.AwayTeamName,
            awayScore: m.AwayTeamScore,
            stadiumName: m.StadiumName,
          },
          update: {
            matchDateTime: parseDbuDateTime(m.MatchDateTime),
            homeTeamName: m.HomeTeamName,
            homeScore: m.HomeTeamScore,
            awayTeamName: m.AwayTeamName,
            awayScore: m.AwayTeamScore,
            stadiumName: m.StadiumName,
            updatedAt: now,
          },
        });
      }

      // Sync standings — replace all rows for this config
      const standingData = await dbuGetStandings(config.poolId, config.teamId);
      await prisma.dbuStanding.deleteMany({ where: { configId: config.id } });
      await prisma.dbuStanding.createMany({
        data: standingData.TeamPositionList.map((s) => ({
          configId: config.id,
          sort: s.Sort,
          teamName: s.TeamName,
          isClubTeam: s.IsClubTeam,
          noOfMatch: s.NoOfMatch,
          matchWon: s.MatchWon,
          matchDrawn: s.MatchDrawn,
          matchLost: s.MatchLost,
          score: s.Score,
          scoreAgainst: s.ScoreAgainst,
          point: s.Point,
          updatedAt: now,
        })),
      });

      await prisma.dbuTeamConfig.update({
        where: { id: config.id },
        data: { lastSyncAt: now },
      });
    } catch (err) {
      console.error(`DBU sync failed for config ${config.id}:`, err);
    }
  }

  return configs.length;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const step = searchParams.get("step") ?? "data";

  try {
    if (step === "discover") {
      const configs = await runDiscover();
      return NextResponse.json({ discovered: configs.length, configs });
    } else {
      const synced = await runDataSync();
      return NextResponse.json({ synced, timestamp: new Date().toISOString() });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
