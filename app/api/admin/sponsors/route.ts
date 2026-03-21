import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") return null;
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sponsors = await prisma.sponsor.findMany({ orderBy: { position: "asc" } });
  return NextResponse.json(sponsors);
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, logoUrl, websiteUrl, position } = await req.json();
  if (!name || !logoUrl) {
    return NextResponse.json({ error: "name og logoUrl er påkrævet" }, { status: 400 });
  }

  const sponsor = await prisma.sponsor.create({
    data: { name, logoUrl, websiteUrl: websiteUrl || null, position: position ?? 999 },
  });
  return NextResponse.json(sponsor, { status: 201 });
}
