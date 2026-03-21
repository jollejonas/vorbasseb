import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") return null;
  return session;
}

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { name, logoUrl, websiteUrl, position } = await req.json();

  try {
    const sponsor = await prisma.sponsor.update({
      where: { id },
      data: { name, logoUrl, websiteUrl: websiteUrl || null, position },
    });
    return NextResponse.json(sponsor);
  } catch {
    return NextResponse.json({ error: "Opdatering fejlede" }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.sponsor.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
