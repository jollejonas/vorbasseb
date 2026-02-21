import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  const slide = await prisma.heroSlide.update({
    where: { id },
    data: {
      type: body.type,
      position: body.position,
      enabled: body.enabled,
      heading: body.heading ?? null,
      subheading: body.subheading ?? null,
      body: body.body ?? null,
      imageUrl: body.imageUrl ?? null,
      ctaLabel: body.ctaLabel ?? null,
      ctaHref: body.ctaHref ?? null,
      overlayOpacity: body.overlayOpacity ?? 40,
      overrideNewsId: body.overrideNewsId || null,
      overrideProductId: body.overrideProductId || null,
    },
    include: {
      overrideNews: { select: { id: true, title: true, slug: true } },
      overrideProduct: { select: { id: true, name: true, slug: true } },
    },
  });

  return NextResponse.json(slide);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await prisma.heroSlide.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
