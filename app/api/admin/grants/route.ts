import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { TrainerGrantStatus } from "@prisma/client";

async function requireAdmin() {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") return null;
  return session;
}

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") ?? undefined;
  const status = (searchParams.get("status") ?? undefined) as TrainerGrantStatus | undefined;

  const grants = await prisma.trainerGrant.findMany({
    where: {
      ...(userId ? { userId } : {}),
      ...(status ? { status } : {}),
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      product: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ grants });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, productId }: { userId: string; productId: string } = await req.json();

  if (!userId || !productId) {
    return NextResponse.json({ error: "userId og productId er påkrævet" }, { status: 400 });
  }

  // Validate: target user must be TRAINER
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { clubRole: true } });
  if (user?.clubRole !== "TRAINER") {
    return NextResponse.json({ error: "Brugeren er ikke en træner" }, { status: 400 });
  }

  // Validate: product must be TRAINER-restricted
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { clubRoleRequired: true },
  });
  if (product?.clubRoleRequired !== "TRAINER") {
    return NextResponse.json({ error: "Produktet er ikke et trænerprodukt" }, { status: 400 });
  }

  const adminId = session!.user!.id as string;
  const grant = await prisma.trainerGrant.create({
    data: {
      userId,
      productId,
      grantedById: adminId,
      status: "PENDING",
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      product: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ grant });
}
