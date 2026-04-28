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

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const colors = await prisma.globalColor.findMany({
    orderBy: { position: "asc" },
  });
  return NextResponse.json(colors);
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, hex, code, position } = await req.json();
  if (!name || !hex || !code) {
    return NextResponse.json({ error: "name, hex og code er påkrævet" }, { status: 400 });
  }
  const normalizedHex = normalizeHexInput(hex);
  if (!normalizedHex) {
    return NextResponse.json({ error: "hex skal være i formatet #RRGGBB" }, { status: 400 });
  }

  try {
    const color = await prisma.globalColor.create({
      data: { name, hex: normalizedHex, code, position: position ?? 0 },
    });
    return NextResponse.json(color, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Kode skal være unik" }, { status: 409 });
  }
}
