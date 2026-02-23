import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

type Params = { params: Promise<{ id: string }> };

const include = { homeTeam: true, awayTeam: true };

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  const match = await prisma.clubMatch.update({
    where: { id },
    data: {
      league: body.league ?? "",
      matchDate: body.matchDate ? new Date(body.matchDate) : null,
      homeTeamId: body.homeTeamId || null,
      homeScore: body.homeScore != null ? Number(body.homeScore) : null,
      awayTeamId: body.awayTeamId || null,
      awayScore: body.awayScore != null ? Number(body.awayScore) : null,
      venue: body.venue ?? "",
      enabled: body.enabled ?? true,
    },
    include,
  });

  return NextResponse.json(match);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await prisma.clubMatch.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
