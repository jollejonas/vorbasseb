import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") return null;
  return session;
}

function toSlugBase(name: string): string {
  return name
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const existing = await prisma.category.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true, id: true },
  });
  const taken = new Set(
    existing.filter((r) => r.id !== excludeId).map((r) => r.slug)
  );
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const categories = await prisma.category.findMany({
    where: { parentId: null },
    orderBy: { position: "asc" },
    include: {
      children: {
        orderBy: { position: "asc" },
        include: { _count: { select: { products: true } } },
      },
      _count: { select: { products: true } },
    },
  });
  return NextResponse.json(categories);
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, parentId } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Navn er påkrævet" }, { status: 400 });
  }

  // Enforce 2-level limit
  if (parentId) {
    const parent = await prisma.category.findUnique({ where: { id: parentId } });
    if (!parent) return NextResponse.json({ error: "Overordnet kategori ikke fundet" }, { status: 404 });
    if (parent.parentId) return NextResponse.json({ error: "Maks 2 niveauer tilladt" }, { status: 400 });
  }

  // Position = max within same parent scope + 1
  const maxPos = await prisma.category.aggregate({
    where: { parentId: parentId ?? null },
    _max: { position: true },
  });
  const position = (maxPos._max.position ?? -1) + 1;

  const slug = await uniqueSlug(toSlugBase(name.trim()));

  const category = await prisma.category.create({
    data: { name: name.trim(), slug, position, parentId: parentId ?? null },
    include: { _count: { select: { products: true } } },
  });
  return NextResponse.json(category, { status: 201 });
}
