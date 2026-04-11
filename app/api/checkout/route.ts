import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { CartItem, OptionSelection, PrintElement } from "@/components/shop/CartProvider";
import { getEffectivePrice } from "@/lib/pricing";

export async function POST(req: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const session = await auth();
  const { items, deliveryMethod = "SHIPPING", promoMode = false }: { items: CartItem[]; deliveryMethod?: "SHIPPING" | "PICKUP"; promoMode?: boolean } = await req.json();

  if (!items || items.length === 0) {
    return NextResponse.json({ error: "Tom kurv" }, { status: 400 });
  }

  // Flatten SKU IDs — pakketilbud contribute multiple item SKUs
  const allSkuIds = items.flatMap((i) =>
    i.isPakketilbud ? (i.pakketilbudItems ?? []).map((c) => c.skuId) : [i.skuId],
  );

  // Enforce clubRoleRequired + fetch authoritative price + option groups
  const skusWithProducts = await prisma.sKU.findMany({
    where: { id: { in: allSkuIds } },
    select: {
      id: true,
      productId: true,
      product: {
        select: {
          price: true,
          clubRoleRequired: true,
          salePrice: true,
          salePriceStart: true,
          salePriceEnd: true,
          optionGroups: {
            select: {
              label: true,
              type: true,
              fee: true,
              values: {
                select: { label: true, price: true },
              },
            },
          },
        },
      },
    },
  });
  for (const sku of skusWithProducts) {
    if (sku.product.clubRoleRequired) {
      // @ts-expect-error custom field
      const userClubRole = session?.user?.clubRole ?? "NONE";
      if (userClubRole !== sku.product.clubRoleRequired) {
        return NextResponse.json({ error: "Ikke autoriseret til dette produkt" }, { status: 403 });
      }
    }
  }

  // Force PICKUP if any item requires a club role
  const hasTrainerItem = skusWithProducts.some((s) => s.product.clubRoleRequired === "TRAINER");
  const effectiveDelivery: "SHIPPING" | "PICKUP" = hasTrainerItem ? "PICKUP" : deliveryMethod;
  const isPickup = effectiveDelivery === "PICKUP";

  const skuProductMap = new Map(skusWithProducts.map((s) => [s.id, s.productId]));

  // Determine which SKUs belong to an actively on-sale product
  const now = new Date();
  const skuOnSaleMap = new Map<string, boolean>();
  for (const sku of skusWithProducts) {
    const { isOnSale } = getEffectivePrice(0, sku.product.salePrice, sku.product.salePriceStart, sku.product.salePriceEnd, now);
    skuOnSaleMap.set(sku.id, isOnSale);
  }

  // Build authoritative server-side price and option group maps
  const skuServerPriceMap = new Map<string, number>();
  const skuOptionGroupsMap = new Map<string, typeof skusWithProducts[0]["product"]["optionGroups"]>();
  for (const sku of skusWithProducts) {
    const { effectivePrice } = getEffectivePrice(
      sku.product.price,
      sku.product.salePrice,
      sku.product.salePriceStart,
      sku.product.salePriceEnd,
      now,
    );
    skuServerPriceMap.set(sku.id, effectivePrice);
    skuOptionGroupsMap.set(sku.id, sku.product.optionGroups);
  }

  // Also check pakketilbud items for sale status
  const pakketilbudIds = items.filter((i) => i.isPakketilbud && i.pakketilbudId).map((i) => i.pakketilbudId!);
  const pakketilbudSaleMap = new Map<string, boolean>();
  const pakkeServerPriceMap = new Map<string, number>();
  if (pakketilbudIds.length > 0) {
    const pakkeSaleData = await prisma.pakketilbud.findMany({
      where: { id: { in: pakketilbudIds } },
      select: { id: true, price: true, salePrice: true, salePriceStart: true, salePriceEnd: true },
    });
    for (const p of pakkeSaleData) {
      const { effectivePrice, isOnSale } = getEffectivePrice(p.price, p.salePrice, p.salePriceStart, p.salePriceEnd, now);
      pakketilbudSaleMap.set(p.id, isOnSale);
      pakkeServerPriceMap.set(p.id, effectivePrice);
    }
  }

  // Fetch authoritative designer zone prices
  const allZoneIds = new Set<number>();
  for (const item of items) {
    for (const pe of (item.printElements ?? [])) allZoneIds.add(pe.zoneId);
    for (const pi of (item.pakketilbudItems ?? [])) {
      for (const pe of (pi.printElements ?? [])) allZoneIds.add(pe.zoneId);
    }
  }
  const zoneServerPriceMap = new Map<number, number>();
  if (allZoneIds.size > 0) {
    const zones = await prisma.designerZone.findMany({
      where: { id: { in: [...allZoneIds] } },
      select: { id: true, price: true },
    });
    for (const z of zones) zoneServerPriceMap.set(z.id, z.price);
  }

  // An item is on sale if its product (or pakketilbud) has an active sale price
  const anyItemOnSale = items.some((item) => {
    if (item.isPakketilbud && item.pakketilbudId) return pakketilbudSaleMap.get(item.pakketilbudId) ?? false;
    return skuOnSaleMap.get(item.skuId) ?? false;
  });

  // ── Server-side price helpers (never trust client-supplied prices) ──────────

  function computeOptionSelectionFee(
    optionGroups: typeof skusWithProducts[0]["product"]["optionGroups"],
    optionSelections?: OptionSelection[],
  ): number {
    if (!optionSelections || optionSelections.length === 0) return 0;
    let fee = 0;
    for (const sel of optionSelections) {
      const group = optionGroups.find((g) => g.label === sel.groupLabel);
      if (!group) continue;
      if ((group.type === "TEXT" || group.type === "CUSTOM") && group.fee && sel.value) {
        fee += group.fee;
      } else if (group.type === "SELECT") {
        const val = group.values.find((v) => v.label === sel.value);
        fee += val?.price ?? 0;
      }
    }
    return fee;
  }

  function computePrintFee(printElements?: PrintElement[]): number {
    return (printElements ?? []).reduce((sum, pe) => sum + (zoneServerPriceMap.get(pe.zoneId) ?? 0), 0);
  }

  /** Returns server-verified effective product price (excl. VAT, in øre). */
  function getServerItemPrice(item: CartItem): number {
    if (item.isPakketilbud && item.pakketilbudId) {
      return pakkeServerPriceMap.get(item.pakketilbudId) ?? 0;
    }
    return skuServerPriceMap.get(item.skuId) ?? 0;
  }

  /** Returns server-verified customization fee (excl. VAT, in øre). */
  function getServerItemCustomizationFee(item: CartItem): number {
    if (item.isPakketilbud) {
      // Sum per-component customization fees from pakketilbudItems
      return (item.pakketilbudItems ?? []).reduce((sum, pi) => {
        const optGroups = skuOptionGroupsMap.get(pi.skuId) ?? [];
        return sum + computeOptionSelectionFee(optGroups, pi.optionSelections) + computePrintFee(pi.printElements);
      }, 0);
    }
    const optGroups = skuOptionGroupsMap.get(item.skuId) ?? [];
    return computeOptionSelectionFee(optGroups, item.optionSelections) + computePrintFee(item.printElements);
  }

  // Read settings
  const cfg = await prisma.siteSetting
    .findMany({ where: { key: { in: ["shipping_flat_ore", "shipping_free_ore", "member_discount_pct", "vat_rate"] } } })
    .catch(() => []);
  const flatOre = parseInt(cfg.find((s) => s.key === "shipping_flat_ore")?.value ?? "4900");
  const freeOre = parseInt(cfg.find((s) => s.key === "shipping_free_ore")?.value ?? "49900");
  const discountPct = parseInt(cfg.find((s) => s.key === "member_discount_pct")?.value ?? "10");
  const vatRate = parseInt(cfg.find((s) => s.key === "vat_rate")?.value ?? "25");

  // Member check
  let isMember = false;
  if (session?.user?.id) {
    const sub = await prisma.subscription.findUnique({ where: { userId: session.user.id } });
    isMember = sub?.status === "ACTIVE";
  }

  // Pending grants
  const pendingGrants = session?.user?.id
    ? await prisma.trainerGrant.findMany({
        where: { userId: session.user.id, status: "PENDING" },
        select: { id: true, productId: true },
      })
    : [];

  const grantPool = new Map<string, string[]>();
  for (const g of pendingGrants) {
    if (!grantPool.has(g.productId)) grantPool.set(g.productId, []);
    grantPool.get(g.productId)!.push(g.id);
  }

  const appliedGrantIds: string[] = [];
  let grantDiscountTotal = 0;
  const grantedQtyMap = new Map<string, number>();

  for (const item of items) {
    const productId = skuProductMap.get(item.skuId);
    if (!productId) continue;
    const pool = grantPool.get(productId);
    if (!pool || pool.length === 0) continue;

    const serverPrice = getServerItemPrice(item);
    const serverFee = getServerItemCustomizationFee(item);
    const unitPriceExcl = serverPrice + serverFee;
    const unitPrice = Math.round(unitPriceExcl * (1 + vatRate / 100));
    let grantedUnits = 0;
    for (let u = 0; u < item.quantity && pool.length > 0; u++) {
      const grantId = pool.shift()!;
      appliedGrantIds.push(grantId);
      grantedUnits++;
      grantDiscountTotal += unitPrice;
    }
    if (grantedUnits > 0) grantedQtyMap.set(item.skuId, grantedUnits);
  }

  // Compute totals using server-derived prices only
  const originalSubtotal = items.reduce((s, i) => {
    const serverPrice = getServerItemPrice(i);
    const serverFee = getServerItemCustomizationFee(i);
    return s + Math.round((serverPrice + serverFee) * (1 + vatRate / 100)) * i.quantity;
  }, 0);
  const effectiveSubtotal = originalSubtotal - grantDiscountTotal;
  const shipping = isPickup ? 0 : effectiveSubtotal >= freeOre ? 0 : flatOre;
  const memberDiscount = (isMember && !anyItemOnSale) ? Math.round(effectiveSubtotal * discountPct / 100) : 0;
  const totalDiscountOre = grantDiscountTotal + memberDiscount;
  const finalTotal = effectiveSubtotal + shipping - memberDiscount;

  // Build order items (used in both zero-total and Stripe paths)
  const orderItemsData = items.map((item) => {
    const serverPrice = getServerItemPrice(item);
    const serverFee = getServerItemCustomizationFee(item);
    if (item.isPakketilbud) {
      return {
        skuId: null as string | null,
        quantity: item.quantity,
        priceAtPurchase: serverPrice + serverFee,
        customName: null as string | null,
        customNumber: null as string | null,
        colorName: null as string | null,
        optionSelections: { isPakketilbud: true, pakketilbudName: item.productName, items: item.pakketilbudItems ?? [] },
      };
    }
    return {
      skuId: item.skuId,
      quantity: item.quantity,
      priceAtPurchase: serverPrice + serverFee,
      customName: item.customName ?? null,
      customNumber: item.customNumber ?? null,
      colorName: item.colorName ?? null,
      optionSelections: item.printElements?.length
        ? { printElements: item.printElements }
        : (item.optionSelections ?? []),
    };
  });

  // ── Zero-total path: skip Stripe, create PAID order directly ─────────────
  if (finalTotal <= 0 && appliedGrantIds.length > 0) {
    await prisma.$transaction(async (tx) => {
      // Decrement stock
      for (const item of items) {
        if (item.isPakketilbud) {
          for (const comp of (item.pakketilbudItems ?? [])) {
            await tx.sKU.update({ where: { id: comp.skuId }, data: { stock: { decrement: item.quantity } } });
          }
        } else {
          await tx.sKU.update({ where: { id: item.skuId }, data: { stock: { decrement: item.quantity } } });
        }
      }

      const created = await tx.order.create({
        data: {
          userId: session?.user?.id ?? null,
          customerName: session?.user?.name ?? null,
          status: "PAID",
          deliveryMethod: "PICKUP",
          total: 0,
          shippingFee: 0,
          discountApplied: grantDiscountTotal,
          items: { create: orderItemsData },
        },
        select: { id: true },
      });

      // Mark grants as used
      const result = await tx.trainerGrant.updateMany({
        where: { id: { in: appliedGrantIds }, status: "PENDING" },
        data: { status: "USED", orderId: created.id },
      });
      if (result.count !== appliedGrantIds.length) {
        throw new Error("En eller flere tildelinger er allerede brugt — prøv igen.");
      }
    });

    return NextResponse.json({ redirect: "/ordre-bekraeftelse" });
  }

  // ── Stripe path ───────────────────────────────────────────────────────────

  // Create PENDING order with all items before redirecting to Stripe
  const pendingOrder = await prisma.order.create({
    data: {
      userId: session?.user?.id ?? null,
      status: "PENDING",
      deliveryMethod: effectiveDelivery,
      total: finalTotal,
      shippingFee: shipping,
      discountApplied: totalDiscountOre,
      items: { create: orderItemsData },
    },
    select: { id: true },
  });

  // Build Stripe line items using server-derived prices
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  for (const item of items) {
    const serverPrice = getServerItemPrice(item);
    const serverFee = getServerItemCustomizationFee(item);
    const unitPriceInclVat = Math.round((serverPrice + serverFee) * (1 + vatRate / 100));
    let name: string;
    if (item.isPakketilbud) {
      const summary = (item.pakketilbudItems ?? [])
        .map((c) => `${(c.label ?? c.productName).slice(0, 30)} (${c.size})`)
        .join(", ");
      name = `${item.productName}: ${summary}`.slice(0, 250);
    } else {
      name = `${item.productName} (${item.size})${
        item.customName || item.customNumber
          ? ` · Tryk: ${item.customName ?? ""} ${item.customNumber ?? ""}`.trim()
          : ""
      }`;
    }
    lineItems.push({
      price_data: {
        currency: "dkk",
        product_data: { name, images: item.image ? [item.image] : [] },
        unit_amount: unitPriceInclVat,
      },
      quantity: item.quantity,
    });
  }

  if (shipping > 0) {
    lineItems.push({
      price_data: {
        currency: "dkk",
        product_data: { name: "Fragt (Danmark)" },
        unit_amount: shipping,
      },
      quantity: 1,
    });
  }

  // Discount / promo code logic
  let discounts: Stripe.Checkout.SessionCreateParams["discounts"] = undefined;
  let allowPromoCodes = false;

  if (appliedGrantIds.length > 0) {
    if (totalDiscountOre > 0) {
      const couponName =
        grantDiscountTotal > 0 && memberDiscount > 0
          ? `Tildeling + Fanklubsrabat ${discountPct}%`
          : grantDiscountTotal > 0
            ? "Tildelt produkt"
            : `Fanklubsrabat ${discountPct}%`;
      const coupon = await stripe.coupons.create({
        amount_off: totalDiscountOre,
        currency: "dkk",
        duration: "once",
        name: couponName,
      });
      discounts = [{ coupon: coupon.id }];
    }
  } else if (isMember && !promoMode) {
    if (memberDiscount > 0) {
      const coupon = await stripe.coupons.create({
        amount_off: memberDiscount,
        currency: "dkk",
        duration: "once",
        name: `Fanklubsrabat ${discountPct}%`,
      });
      discounts = [{ coupon: coupon.id }];
    }
  } else if (!anyItemOnSale) {
    allowPromoCodes = true;
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Create Stripe session — only orderId in metadata (avoids 500-char limit on cartJson)
  let checkoutSession: Stripe.Checkout.Session;
  try {
    checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      discounts,
      ...(allowPromoCodes ? { allow_promotion_codes: true } : {}),
      customer_email: session?.user?.email ?? undefined,
      metadata: {
        orderId: pendingOrder.id,
        userId: session?.user?.id ?? "",
        grantIds: JSON.stringify(appliedGrantIds),
        vatRate: String(vatRate),
      },
      success_url: `${baseUrl}/ordre-bekraeftelse?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/kurv`,
      phone_number_collection: { enabled: true },
      billing_address_collection: "required",
      ...(isPickup ? {} : { shipping_address_collection: { allowed_countries: ["DK"] } }),
      locale: "da",
    });
  } catch (err) {
    // Clean up the pending order so it doesn't accumulate
    await prisma.order.delete({ where: { id: pendingOrder.id } }).catch(() => {});
    throw err;
  }

  // Store the Stripe session ID on the order for idempotency
  await prisma.order.update({
    where: { id: pendingOrder.id },
    data: { stripeSessionId: checkoutSession.id },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
