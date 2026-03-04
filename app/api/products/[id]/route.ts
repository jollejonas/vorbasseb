import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      skus: true,
      colorVariants: { include: { skus: true }, orderBy: { position: "asc" } },
    },
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

  type SkuInput = { id?: string; size: string; stock: number; itemNumber?: string | null };
  type ColorVariantInput = {
    id?: string; name: string; hex: string; images: string[]; position?: number;
    skus: SkuInput[];
  };

  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id },
      data: {
        name: body.name,
        slug: body.slug,
        description: body.description,
        categoryId: body.categoryId ?? null,
        price: body.price,
        customizationFee: body.customizationFee ?? null,
        membersOnly: body.membersOnly,
        membersEarlyAccess: body.membersEarlyAccess ?? false,
        clubRoleRequired: body.clubRoleRequired ?? null,
        customizationLabel: body.customizationLabel ?? null,
        customizationShowNumber: body.customizationShowNumber ?? true,
        published: body.published,
        featured: body.featured,
        images: body.images,
      },
    });

    const hasColorVariants = Array.isArray(body.colorVariants) && body.colorVariants.length > 0;

    if (hasColorVariants) {
      const cvInputs = body.colorVariants as ColorVariantInput[];
      const incomingCvIds = cvInputs.filter((cv) => cv.id).map((cv) => cv.id!);

      // Delete removed color variants (cascade deletes their SKUs)
      await tx.colorVariant.deleteMany({
        where: { productId: id, id: { notIn: incomingCvIds } },
      });

      for (let i = 0; i < cvInputs.length; i++) {
        const cv = cvInputs[i];
        let cvId: string;

        if (cv.id) {
          await tx.colorVariant.update({
            where: { id: cv.id },
            data: { name: cv.name, hex: cv.hex, images: cv.images ?? [], position: i },
          });
          cvId = cv.id;
        } else {
          const created = await tx.colorVariant.create({
            data: { productId: id, name: cv.name, hex: cv.hex, images: cv.images ?? [], position: i },
          });
          cvId = created.id;
        }

        // Upsert SKUs for this color variant
        const skuInputs = cv.skus ?? [];
        const existingSkus = skuInputs.filter((s) => s.id);
        const freshSkus = skuInputs.filter((s) => !s.id);
        const incomingSkuIds = existingSkus.map((s) => s.id!);

        await tx.sKU.deleteMany({ where: { colorVariantId: cvId, id: { notIn: incomingSkuIds } } });
        await Promise.all([
          ...existingSkus.map((s) =>
            tx.sKU.update({ where: { id: s.id! }, data: { stock: s.stock, itemNumber: s.itemNumber ?? null } })
          ),
          ...freshSkus.map((s) =>
            tx.sKU.create({ data: { productId: id, colorVariantId: cvId, size: s.size, stock: s.stock, itemNumber: s.itemNumber ?? null } })
          ),
        ]);
      }

      // Remove any non-color-variant SKUs if switching to color mode
      await tx.sKU.deleteMany({ where: { productId: id, colorVariantId: null } });

    } else if (body.skus && Array.isArray(body.skus)) {
      // No color variants — manage global SKUs
      const skuInputs = body.skus as SkuInput[];
      const existing = skuInputs.filter((s) => s.id);
      const fresh = skuInputs.filter((s) => !s.id);
      const incomingIds = existing.map((s) => s.id!);

      await tx.sKU.deleteMany({ where: { productId: id, id: { notIn: incomingIds }, colorVariantId: null } });
      await Promise.all([
        ...existing.map((s) =>
          tx.sKU.update({ where: { id: s.id! }, data: { stock: s.stock, itemNumber: s.itemNumber ?? null } })
        ),
        ...fresh.map((s) =>
          tx.sKU.create({ data: { productId: id, size: s.size, stock: s.stock, itemNumber: s.itemNumber ?? null } })
        ),
      ]);
    }
  });

  const result = await prisma.product.findUnique({
    where: { id },
    include: {
      skus: true,
      colorVariants: { include: { skus: true }, orderBy: { position: "asc" } },
    },
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
