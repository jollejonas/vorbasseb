import { NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ isMember: false, discountPct: 10 });
  }

  const [sub, setting] = await Promise.all([
    prisma.subscription.findUnique({ where: { userId: session.user.id } }),
    prisma.siteSetting.findUnique({ where: { key: "member_discount_pct" } }),
  ]);

  const isMember = sub?.status === "ACTIVE";
  const discountPct = parseInt(setting?.value ?? "10");

  return NextResponse.json({ isMember, discountPct });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sub = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
  });

  if (!sub || sub.status !== "ACTIVE") {
    return NextResponse.json({ error: "No active subscription" }, { status: 400 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  await stripe.subscriptions.cancel(sub.stripeSubscriptionId);

  await prisma.subscription.update({
    where: { userId: session.user.id },
    data: { status: "CANCELED" },
  });

  return NextResponse.json({ success: true });
}
