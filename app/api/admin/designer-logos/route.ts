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

  const logos = await prisma.designerLogo.findMany({ orderBy: { id: "asc" } });
  return NextResponse.json(logos);
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, imageUrl, isClub } = await req.json();
  if (!name || !imageUrl) {
    return NextResponse.json({ error: "name og imageUrl er påkrævet" }, { status: 400 });
  }

  const logo = await prisma.designerLogo.create({
    data: { name, imageUrl, isClub: isClub ?? false },
  });
  return NextResponse.json(logo, { status: 201 });
}
