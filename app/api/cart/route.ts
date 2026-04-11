import { NextRequest, NextResponse } from "next/server";
import type { CartItem } from "@/components/shop/CartProvider";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

function normalizeCartItems(input: unknown): CartItem[] {
  if (!Array.isArray(input)) return [];

  return input
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => {
      const rawQty = typeof item.quantity === "number" ? Math.trunc(item.quantity) : 1;
      const quantity = Number.isFinite(rawQty) ? Math.max(1, rawQty) : 1;
      return { ...(item as CartItem), quantity };
    });
}

async function getSessionUserId() {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cart = await prisma.cart.findUnique({
    where: { userId },
    select: { items: true },
  });

  return NextResponse.json({ items: normalizeCartItems(cart?.items) });
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const items = normalizeCartItems(body?.items);

  await prisma.cart.upsert({
    where: { userId },
    create: { userId, items },
    update: { items },
  });

  return NextResponse.json({ ok: true, items });
}

export async function DELETE() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.cart.deleteMany({ where: { userId } });

  return NextResponse.json({ ok: true });
}
