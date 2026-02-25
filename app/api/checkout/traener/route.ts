import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { CartItem } from "@/components/shop/CartProvider";

export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Log ind for at bestille trænerprodukter" }, { status: 401 });
  }

  // @ts-expect-error custom field
  const clubRole = session.user.clubRole ?? "NONE";
  if (clubRole !== "TRAINER") {
    return NextResponse.json({ error: "Kun trænere kan bestille via denne side" }, { status: 403 });
  }

  const { items }: { items: CartItem[] } = await req.json();

  if (!items || items.length === 0) {
    return NextResponse.json({ error: "Tom kurv" }, { status: 400 });
  }

  // Verify all SKUs exist and belong to TRAINER-restricted products
  const skuIds = items.map((i) => i.skuId);
  const skus = await prisma.sKU.findMany({
    where: { id: { in: skuIds } },
    select: {
      id: true,
      stock: true,
      product: { select: { clubRoleRequired: true, name: true } },
    },
  });

  if (skus.length !== skuIds.length) {
    return NextResponse.json({ error: "Ukendt produkt i kurven" }, { status: 400 });
  }

  for (const sku of skus) {
    if (sku.product.clubRoleRequired !== "TRAINER") {
      return NextResponse.json(
        { error: `"${sku.product.name}" er ikke et trænerprodukt` },
        { status: 400 },
      );
    }
  }

  // Check stock
  for (const item of items) {
    const sku = skus.find((s) => s.id === item.skuId);
    if (!sku || sku.stock < item.quantity) {
      return NextResponse.json(
        { error: `Ikke nok på lager for valgt størrelse` },
        { status: 400 },
      );
    }
  }

  // Create order directly — no payment required
  const order = await prisma.$transaction(async (tx) => {
    // Decrement stock
    for (const item of items) {
      await tx.sKU.update({
        where: { id: item.skuId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    return tx.order.create({
      data: {
        userId: session.user!.id,
        customerName: session.user?.name ?? null,
        status: "PAID",
        deliveryMethod: "PICKUP",
        total: 0,
        shippingFee: 0,
        discountApplied: 0,
        items: {
          create: items.map((item) => ({
            skuId: item.skuId,
            quantity: item.quantity,
            priceAtPurchase: 0,
            customName: item.customName ?? null,
            customNumber: item.customNumber ?? null,
          })),
        },
      },
      select: { id: true, orderNumber: true },
    });
  });

  return NextResponse.json({ orderId: order.id, orderNumber: order.orderNumber });
}
