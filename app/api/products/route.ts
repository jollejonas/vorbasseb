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
      // Non-members can still see member products (just can't buy them)
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { skus: true, category: true },
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
  const product = await prisma.product.create({
    data: {
      name: body.name,
      slug: body.slug,
      description: body.description,
      categoryId: body.categoryId ?? null,
      price: body.price,
      customizationFee: body.customizationFee ?? null,
      membersOnly: body.membersOnly ?? false,
      membersEarlyAccess: body.membersEarlyAccess ?? false,
      published: body.published ?? true,
      featured: body.featured ?? false,
      images: body.images ?? [],
      skus: {
        create: body.skus ?? [],
      },
    },
    include: { skus: true, category: true },
  });

  return NextResponse.json(product, { status: 201 });
}
