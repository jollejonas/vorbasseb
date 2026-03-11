import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

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
            where: { colorVariantId: null },
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

export async function GET() {
  const pakketilbud = await prisma.pakketilbud.findMany({
    where: { published: true },
    include: PAKKE_INCLUDE,
    orderBy: [{ position: "asc" }, { createdAt: "desc" }],
  });
  return NextResponse.json(pakketilbud);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();

  const pakketilbud = await prisma.pakketilbud.create({
    data: {
      name: body.name,
      slug: body.slug,
      description: body.description ?? "",
      price: body.price,
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

  return NextResponse.json(pakketilbud, { status: 201 });
}
