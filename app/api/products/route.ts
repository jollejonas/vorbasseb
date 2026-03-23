import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const category = searchParams.get("category");
  const q = searchParams.get("q");
  const featured = searchParams.get("featured");

  const session = await auth();
  // @ts-expect-error custom field
  const isMember = session?.user?.subscriptionStatus === "ACTIVE";

  const products = await prisma.product.findMany({
    where: {
      published: true,
      ...(category ? { category: { slug: category } } : {}),
      ...(featured === "true" ? { featured: true } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      skus: { include: { optionValues: { include: { optionValue: true } } } },
      category: true,
      colorVariants: { include: { skus: true }, orderBy: { position: "asc" } },
      optionGroups: {
        include: {
          values: {
            include: { globalColor: true },
            orderBy: { position: "asc" },
          },
        },
        orderBy: { position: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    products.map((p) => ({
      ...p,
      _isMemberRequired: p.membersOnly && !isMember,
    })),
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();

  type ColorVariantInput = {
    name: string; hex: string; images: string[]; position?: number;
    skus: { size: string; stock: number; itemNumber?: string | null }[];
  };

  const cvInputs: ColorVariantInput[] = body.colorVariants ?? [];
  const hasColorVariants = cvInputs.length > 0;

  // Create product (+ global skus if no color variants and no option groups)
  const product = await prisma.product.create({
    data: {
      name: body.name,
      slug: body.slug,
      description: body.description,
      categoryId: body.categoryId ?? null,
      price: body.price,
      salePrice: body.salePrice ?? null,
      salePriceStart: body.salePriceStart ? new Date(body.salePriceStart) : null,
      salePriceEnd: body.salePriceEnd ? new Date(body.salePriceEnd) : null,
      modelNumber: body.modelNumber ?? null,
      membersOnly: body.membersOnly ?? false,
      membersEarlyAccess: body.membersEarlyAccess ?? false,
      clubRoleRequired: body.clubRoleRequired ?? null,
      published: body.published ?? true,
      featured: body.featured ?? false,
      images: body.images ?? [],
      skus: (!hasColorVariants && !body.optionGroups?.length) ? { create: body.skus ?? [] } : undefined,
    },
    include: { skus: true, category: true },
  });

  // Legacy color variants path
  if (hasColorVariants) {
    for (let i = 0; i < cvInputs.length; i++) {
      const cv = cvInputs[i];
      const created = await prisma.colorVariant.create({
        data: { productId: product.id, name: cv.name, hex: cv.hex, images: cv.images ?? [], position: cv.position ?? i },
      });
      if (cv.skus?.length) {
        await prisma.sKU.createMany({
          data: cv.skus.map((s) => ({
            productId: product.id,
            colorVariantId: created.id,
            size: s.size,
            stock: s.stock,
            itemNumber: s.itemNumber ?? null,
          })),
        });
      }
    }
  }

  const result = await prisma.product.findUnique({
    where: { id: product.id },
    include: {
      skus: { include: { optionValues: { include: { optionValue: true } } } },
      category: true,
      colorVariants: { include: { skus: true }, orderBy: { position: "asc" } },
      optionGroups: {
        include: { values: { include: { globalColor: true }, orderBy: { position: "asc" } } },
        orderBy: { position: "asc" },
      },
    },
  });
  return NextResponse.json(result, { status: 201 });
}
