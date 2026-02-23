import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { name, email, role, membershipAction } = body;

  if (membershipAction === "grant") {
    await prisma.subscription.upsert({
      where: { userId: id },
      create: {
        userId: id,
        stripeSubscriptionId: `manual_${id}`,
        stripeCustomerId: `manual_${id}`,
        status: "ACTIVE",
        plan: "MONTHLY",
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
      update: {
        status: "ACTIVE",
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (membershipAction === "revoke") {
    await prisma.subscription.updateMany({
      where: { userId: id },
      data: { status: "CANCELED" },
    });
    return NextResponse.json({ ok: true });
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(email !== undefined ? { email } : {}),
      ...(role !== undefined ? { role } : {}),
    },
  });

  return NextResponse.json(updated);
}
