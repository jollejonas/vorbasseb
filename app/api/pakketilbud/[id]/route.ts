import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

type Params = { params: Promise<{ id: string }> };

const PAKKE_INCLUDE = {
  items: {
    include: {
      product: {
        include: {
          optionGroups: {
            include: {
              values: { include: { globalColor: true }, orderBy: { position: "asc" as const } },
            },
            orderBy: { position: "asc" as const },
          },
          skus: {
            include: { optionValues: { select: { optionValueId: true } } },
          },
          colorVariants: {
            include: { skus: { orderBy: { size: "asc" as const } } },
            orderBy: { position: "asc" as const },
          },
        },
      },
    },
    orderBy: { position: "asc" as const },
  },
} as const;

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const pakketilbud = await prisma.pakketilbud.findUnique({
    where: { id },
    include: PAKKE_INCLUDE,
  });
  if (!pakketilbud) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(pakketilbud);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  const pakketilbud = await prisma.$transaction(async (tx) => {
    // Delete all existing items, then recreate in correct order
    await tx.pakketilbudItem.deleteMany({ where: { pakketilbudId: id } });

    return tx.pakketilbud.update({
      where: { id },
      data: {
        name: body.name,
        slug: body.slug,
        description: body.description ?? "",
        price: body.price,
        salePrice: body.salePrice ?? null,
        salePriceStart: body.salePriceStart ? new Date(body.salePriceStart) : null,
        salePriceEnd: body.salePriceEnd ? new Date(body.salePriceEnd) : null,
        images: body.images ?? [],
        published: body.published ?? true,
        featured: body.featured ?? false,
        position: body.position ?? 0,
        items: {
          create: (body.items ?? []).map(
            (item: { productId: string; label?: string; position?: number }, i: number) => ({
              productId: item.productId,
              label: item.label ?? null,
              position: item.position ?? i,
            }),
          ),
        },
      },
      include: PAKKE_INCLUDE,
    });
  });

  return NextResponse.json(pakketilbud);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await prisma.pakketilbud.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
