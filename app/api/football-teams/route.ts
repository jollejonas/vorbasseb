import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const teams = await prisma.footballTeam.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(teams);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const team = await prisma.footballTeam.create({
    data: {
      name: body.name,
      logo: body.logo || null,
      defaultVenue: body.defaultVenue || null,
    },
  });
  return NextResponse.json(team, { status: 201 });
}
