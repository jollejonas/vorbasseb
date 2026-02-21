import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const slides = await prisma.heroSlide.findMany({
    orderBy: { position: "asc" },
    include: {
      overrideNews: { select: { id: true, title: true, slug: true } },
      overrideProduct: { select: { id: true, name: true, slug: true } },
    },
  });
  return NextResponse.json(slides);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const count = await prisma.heroSlide.count();

  const slide = await prisma.heroSlide.create({
    data: {
      type: body.type ?? "CUSTOM",
      position: body.position ?? count,
      enabled: body.enabled ?? true,
      heading: body.heading ?? null,
      subheading: body.subheading ?? null,
      body: body.body ?? null,
      imageUrl: body.imageUrl ?? null,
      ctaLabel: body.ctaLabel ?? null,
      ctaHref: body.ctaHref ?? null,
      overlayOpacity: body.overlayOpacity ?? 40,
      overrideNewsId: body.overrideNewsId ?? null,
      overrideProductId: body.overrideProductId ?? null,
    },
    include: {
      overrideNews: { select: { id: true, title: true, slug: true } },
      overrideProduct: { select: { id: true, name: true, slug: true } },
    },
  });

  return NextResponse.json(slide, { status: 201 });
}
