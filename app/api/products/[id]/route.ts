import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    include: { skus: true },
  });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(product);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  type SkuInput = { id?: string; size: string; stock: number };

  const [product] = await prisma.$transaction(async (tx) => {
    const updated = await tx.product.update({
      where: { id },
      data: {
        name: body.name,
        slug: body.slug,
        description: body.description,
        category: body.category,
        price: body.price,
        customizationFee: body.customizationFee ?? null,
        membersOnly: body.membersOnly,
        published: body.published,
        featured: body.featured,
        images: body.images,
      },
      include: { skus: true },
    });

    if (body.skus && Array.isArray(body.skus)) {
      const skuInputs = body.skus as SkuInput[];
      const existing = skuInputs.filter((s) => s.id);
      const fresh = skuInputs.filter((s) => !s.id);

      await Promise.all([
        ...existing.map((s) =>
          tx.sKU.update({ where: { id: s.id! }, data: { stock: s.stock } })
        ),
        ...fresh.map((s) =>
          tx.sKU.create({ data: { productId: id, size: s.size, stock: s.stock } })
        ),
      ]);
    }

    return [updated];
  });

  const result = await prisma.product.findUnique({
    where: { id },
    include: { skus: true },
  });

  return NextResponse.json(result);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await prisma.product.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
