import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

function normalizeHexInput(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  return HEX_COLOR_RE.test(normalized) ? normalized.toUpperCase() : null;
}

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
  const { name, hex, code, position } = await req.json();
  const normalizedHex = normalizeHexInput(hex);
  if (!normalizedHex) {
    return NextResponse.json({ error: "hex skal være i formatet #RRGGBB" }, { status: 400 });
  }

  try {
    const color = await prisma.globalColor.update({
      where: { id },
      data: { name, hex: normalizedHex, code, position },
    });
    return NextResponse.json(color);
  } catch {
    return NextResponse.json({ error: "Opdatering fejlede" }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Check if any ProductOptionValues reference this color
  const usages = await prisma.productOptionValue.count({
    where: { globalColorId: id },
  });
  if (usages > 0) {
    return NextResponse.json(
      { error: `Farven er i brug på ${usages} produkt(er) og kan ikke slettes` },
      { status: 409 },
    );
  }

  await prisma.globalColor.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
