import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") return null;
  return session;
}

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const {
    designerEnabled,
    designerFrontImageIdx,
    designerBackImageIdx,
    designerPrintColor,
    zones,
  } = body as {
    designerEnabled: boolean;
    designerFrontImageIdx: number | null;
    designerBackImageIdx: number | null;
    designerPrintColor: string | null;
    zones: {
      side: string;
      label: string;
      position: string;
      allowText: boolean;
      allowLogo: boolean;
      previewX: number;
      previewY: number;
      previewW: number;
      previewH: number;
      price: number;
      positionOrd: number;
    }[];
  };

  await prisma.$transaction([
    prisma.product.update({
      where: { id },
      data: {
        designerEnabled,
        designerFrontImageIdx: designerFrontImageIdx ?? null,
        designerBackImageIdx: designerBackImageIdx ?? null,
        designerPrintColor: designerPrintColor || null,
      },
    }),
    prisma.designerZone.deleteMany({ where: { productId: id } }),
    ...(zones ?? []).map((z, i) =>
      prisma.designerZone.create({
        data: {
          productId: id,
          side: z.side,
          label: z.label,
          position: z.position,
          allowText: z.allowText,
          allowLogo: z.allowLogo,
          previewX: z.previewX,
          previewY: z.previewY,
          previewW: z.previewW,
          previewH: z.previewH,
          price: z.price ?? 0,
          positionOrd: i,
        },
      })
    ),
  ]);

  const updated = await prisma.product.findUnique({
    where: { id },
    include: { designerZones: { orderBy: { positionOrd: "asc" } } },
  });
  return NextResponse.json(updated);
}
