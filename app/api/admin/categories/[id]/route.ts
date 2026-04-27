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

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { name, direction } = await req.json();

  const current = await prisma.category.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Ikke fundet" }, { status: 404 });

  if (direction === "up" || direction === "down") {
    // Swap positions with adjacent sibling at the same level
    const siblings = await prisma.category.findMany({
      where: { parentId: current.parentId },
      orderBy: { position: "asc" },
    });
    const idx = siblings.findIndex((s) => s.id === id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= siblings.length) {
      return NextResponse.json({ error: "Kan ikke flytte" }, { status: 400 });
    }
    const swapTarget = siblings[swapIdx];
    await prisma.$transaction([
      prisma.category.update({ where: { id }, data: { position: swapTarget.position } }),
      prisma.category.update({ where: { id: swapTarget.id }, data: { position: current.position } }),
    ]);
    return NextResponse.json({ ok: true });
  }

  if (name !== undefined) {
    const slug = await uniqueSlug(toSlugBase(name.trim()), id);
    const updated = await prisma.category.update({
      where: { id },
      data: { name: name.trim(), slug },
      include: { _count: { select: { products: true } } },
    });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Ingen handling" }, { status: 400 });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const category = await prisma.category.findUnique({
    where: { id },
    include: { children: { select: { id: true } } },
  });
  if (!category) return NextResponse.json({ error: "Ikke fundet" }, { status: 404 });

  const allIds = [id, ...category.children.map((c) => c.id)];

  const affectedProducts = await prisma.product.count({
    where: { categoryId: { in: allIds } },
  });

  // Order matters: null products → delete children → delete parent
  await prisma.$transaction([
    prisma.product.updateMany({ where: { categoryId: { in: allIds } }, data: { categoryId: null } }),
    prisma.category.deleteMany({ where: { parentId: id } }),
    prisma.category.delete({ where: { id } }),
  ]);

  return NextResponse.json({ ok: true, affectedProducts });
}
