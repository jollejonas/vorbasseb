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

  const sizes = await prisma.sizePreset.findMany({ orderBy: { position: "asc" } });
  return NextResponse.json(sizes);
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { label, position } = await req.json();
  if (!label) return NextResponse.json({ error: "label er påkrævet" }, { status: 400 });

  try {
    const size = await prisma.sizePreset.create({
      data: { label, position: position ?? 999 },
    });
    return NextResponse.json(size, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Størrelsen findes allerede" }, { status: 409 });
  }
}
