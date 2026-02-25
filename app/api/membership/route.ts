import { NextResponse } from "next/server";
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
