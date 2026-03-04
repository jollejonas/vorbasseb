import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({ productId: z.string().min(1) });

export async function POST(req: Request) {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { productId } = parsed.data;
  const adminId = session!.user!.id as string;

  // Validate product exists and is a trainer product
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, clubRoleRequired: true },
  });

  if (!product || product.clubRoleRequired !== "TRAINER") {
    return NextResponse.json({ error: "Product not found or not a trainer product" }, { status: 404 });
  }

  // Get all trainers
  const trainers = await prisma.user.findMany({
    where: { clubRole: "TRAINER" },
    select: { id: true },
  });

  if (trainers.length === 0) {
    return NextResponse.json({ created: 0 });
  }

  // Find trainers who already have a PENDING grant for this product
  const existing = await prisma.trainerGrant.findMany({
    where: {
      productId,
      status: "PENDING",
      userId: { in: trainers.map((t) => t.id) },
    },
    select: { userId: true },
  });

  const existingUserIds = new Set(existing.map((g) => g.userId));
  const toGrant = trainers.filter((t) => !existingUserIds.has(t.id));

  if (toGrant.length === 0) {
    return NextResponse.json({ created: 0 });
  }

  await prisma.trainerGrant.createMany({
    data: toGrant.map((t) => ({
      userId: t.id,
      productId,
      grantedById: adminId,
      status: "PENDING",
    })),
  });

  return NextResponse.json({ created: toGrant.length });
}
