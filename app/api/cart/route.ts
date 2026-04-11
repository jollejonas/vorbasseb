import { Prisma } from "@prisma/client";
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

function isMissingCartStorage(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  );
}

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const cart = await prisma.cart.findUnique({
      where: { userId },
      select: { items: true },
    });

    return NextResponse.json({ items: normalizeCartItems(cart?.items) });
  } catch (error) {
    if (isMissingCartStorage(error)) {
      return NextResponse.json({ items: [], storage: "local" });
    }

    throw error;
  }
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const items = normalizeCartItems(body?.items);

  try {
    await prisma.cart.upsert({
      where: { userId },
      create: { userId, items },
      update: { items },
    });
  } catch (error) {
    if (isMissingCartStorage(error)) {
      return NextResponse.json({ ok: true, items, storage: "local" });
    }

    throw error;
  }

  return NextResponse.json({ ok: true, items });
}

export async function DELETE() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await prisma.cart.deleteMany({ where: { userId } });
  } catch (error) {
    if (isMissingCartStorage(error)) {
      return NextResponse.json({ ok: true, storage: "local" });
    }

    throw error;
  }

  return NextResponse.json({ ok: true });
}
