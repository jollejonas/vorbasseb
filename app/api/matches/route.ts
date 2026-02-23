import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

const include = { homeTeam: true, awayTeam: true };

export async function GET() {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const matches = await prisma.clubMatch.findMany({
    include,
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(matches);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { clubTeam, isUpcoming, league, matchDate, homeTeamId, homeScore, awayTeamId, awayScore, venue, enabled } = body;

  const data = {
    league: league ?? "",
    matchDate: matchDate ? new Date(matchDate) : null,
    homeTeamId: homeTeamId || null,
    homeScore: homeScore != null ? Number(homeScore) : null,
    awayTeamId: awayTeamId || null,
    awayScore: awayScore != null ? Number(awayScore) : null,
    venue: venue ?? "",
    enabled: enabled ?? true,
  };

  const match = await prisma.clubMatch.upsert({
    where: { clubTeam_isUpcoming: { clubTeam, isUpcoming } },
    create: { clubTeam, isUpcoming, ...data },
    update: data,
    include,
  });

  return NextResponse.json(match, { status: 201 });
}
