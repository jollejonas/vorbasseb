import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ grants: [] });
  }

  const grants = await prisma.trainerGrant.findMany({
    where: { userId: session.user.id, status: "PENDING" },
    select: {
      id: true,
      productId: true,
      product: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    grants: grants.map((g) => ({
      id: g.id,
      productId: g.productId,
      productName: g.product.name,
    })),
  });
}
