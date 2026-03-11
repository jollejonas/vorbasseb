import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { CartItem } from "@/components/shop/CartProvider";

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

  // Enforce clubRoleRequired: look up products for each cart item
  const skusWithProducts = await prisma.sKU.findMany({
    where: { id: { in: allSkuIds } },
    select: { id: true, productId: true, product: { select: { clubRoleRequired: true } } },
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

  // Force PICKUP if any item requires a club role (all restricted items are pickup-only)
  const hasTrainerItem = skusWithProducts.some((s) => s.product.clubRoleRequired === "TRAINER");
  const effectiveDelivery: "SHIPPING" | "PICKUP" = hasTrainerItem ? "PICKUP" : deliveryMethod;
  const isPickup = effectiveDelivery === "PICKUP";

  // Build skuId → productId map for grant matching (non-bundle items only)
  const skuProductMap = new Map(skusWithProducts.map((s) => [s.id, s.productId]));

  // Read shipping rules, member discount, and VAT rate from DB
  const cfg = await prisma.siteSetting
    .findMany({ where: { key: { in: ["shipping_flat_ore", "shipping_free_ore", "member_discount_pct", "vat_rate"] } } })
    .catch(() => []);
  const flatOre = parseInt(cfg.find((s) => s.key === "shipping_flat_ore")?.value ?? "4900");
  const freeOre = parseInt(cfg.find((s) => s.key === "shipping_free_ore")?.value ?? "49900");
  const discountPct = parseInt(cfg.find((s) => s.key === "member_discount_pct")?.value ?? "10");
  const vatRate = parseInt(cfg.find((s) => s.key === "vat_rate")?.value ?? "25");

  // Check if user is an active member (for discount)
  let isMember = false;
  if (session?.user?.id) {
    const sub = await prisma.subscription.findUnique({ where: { userId: session.user.id } });
    isMember = sub?.status === "ACTIVE";
  }

  // Resolve pending grants for this user
  const pendingGrants = session?.user?.id
    ? await prisma.trainerGrant.findMany({
        where: { userId: session.user.id, status: "PENDING" },
        select: { id: true, productId: true },
      })
    : [];

  // Build grant pool: productId → queue of grantIds (one consumed per unit)
  const grantPool = new Map<string, string[]>();
  for (const g of pendingGrants) {
    if (!grantPool.has(g.productId)) grantPool.set(g.productId, []);
    grantPool.get(g.productId)!.push(g.id);
  }

  // Determine which item units are covered by grants
  // appliedGrantIds = grants we'll consume; grantDiscountTotal = value in øre
  const appliedGrantIds: string[] = [];
  let grantDiscountTotal = 0;

  // Per-item: how many units are granted
  const grantedQtyMap = new Map<string, number>(); // skuId → granted quantity

  for (const item of items) {
    const productId = skuProductMap.get(item.skuId);
    if (!productId) continue;
    const pool = grantPool.get(productId);
    if (!pool || pool.length === 0) continue;

    const unitPriceExcl = item.price + (item.customizationFee ?? 0);
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

  // Compute totals (all incl. VAT)
  const originalSubtotal = items.reduce(
    (s, i) => s + Math.round((i.price + (i.customizationFee ?? 0)) * (1 + vatRate / 100)) * i.quantity,
    0,
  );
  const effectiveSubtotal = originalSubtotal - grantDiscountTotal;
  const shipping = isPickup ? 0 : effectiveSubtotal >= freeOre ? 0 : flatOre;
  const memberDiscount = isMember ? Math.round(effectiveSubtotal * discountPct / 100) : 0;
  const totalDiscountOre = grantDiscountTotal + memberDiscount;
  const finalTotal = effectiveSubtotal + shipping - memberDiscount;

  // ── Zero-total path: skip Stripe, create order directly ──────────────────
  if (finalTotal <= 0 && appliedGrantIds.length > 0) {
    const order = await prisma.$transaction(async (tx) => {
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

      // Create order
      const created = await tx.order.create({
        data: {
          userId: session?.user?.id ?? null,
          customerName: session?.user?.name ?? null,
          status: "PAID",
          deliveryMethod: "PICKUP",
          total: 0,
          shippingFee: 0,
          discountApplied: grantDiscountTotal,
          items: {
            create: items.map((item) => {
              if (item.isPakketilbud) {
                return {
                  skuId: null,
                  quantity: item.quantity,
                  priceAtPurchase: 0,
                  customName: null,
                  customNumber: null,
                  colorName: null,
                  optionSelections: { isPakketilbud: true, pakketilbudName: item.productName, items: item.pakketilbudItems ?? [] },
                };
              }
              return {
                skuId: item.skuId,
                quantity: item.quantity,
                priceAtPurchase: 0,
                customName: item.customName ?? null,
                customNumber: item.customNumber ?? null,
                colorName: item.colorName ?? null,
                optionSelections: item.printElements?.length
                  ? { printElements: item.printElements }
                  : (item.optionSelections ?? []),
              };
            }),
          },
        },
        select: { id: true, orderNumber: true },
      });

      // Mark grants as used — with race condition guard
      const result = await tx.trainerGrant.updateMany({
        where: { id: { in: appliedGrantIds }, status: "PENDING" },
        data: { status: "USED", orderId: created.id },
      });
      if (result.count !== appliedGrantIds.length) {
        throw new Error("En eller flere tildelinger er allerede brugt — prøv igen.");
      }

      return created;
    });

    return NextResponse.json({ redirect: "/ordre-bekraeftelse" });
  }

  // ── Stripe path ───────────────────────────────────────────────────────────

  // Build line items at original prices — grants applied via coupon (Stripe rejects unit_amount: 0)
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

  for (const item of items) {
    const unitPriceExclVat = item.price + (item.customizationFee ?? 0);
    const unitPriceInclVat = Math.round(unitPriceExclVat * (1 + vatRate / 100));
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
  // Stripe does not allow allow_promotion_codes and discounts simultaneously.
  let discounts: Stripe.Checkout.SessionCreateParams["discounts"] = undefined;
  let allowPromoCodes = false;

  if (appliedGrantIds.length > 0) {
    // Grants present: apply combined grant + member coupon; no promo field
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
    // Member, default mode: apply member discount as coupon
    if (memberDiscount > 0) {
      const coupon = await stripe.coupons.create({
        amount_off: memberDiscount,
        currency: "dkk",
        duration: "once",
        name: `Fanklubsrabat ${discountPct}%`,
      });
      discounts = [{ coupon: coupon.id }];
    }
  } else {
    // Non-member, or member who opted into promo mode: show promo code field
    allowPromoCodes = true;
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    discounts,
    ...(allowPromoCodes ? { allow_promotion_codes: true } : {}),
    customer_email: session?.user?.email ?? undefined,
    metadata: {
      userId: session?.user?.id ?? "",
      cartJson: JSON.stringify(
        items.map((i) => {
          if (i.isPakketilbud) {
            return {
              skuId: i.skuId,
              isPakketilbud: true,
              productName: i.productName ?? "",
              size: "",
              quantity: i.quantity,
              price: i.price,
              customizationFee: i.customizationFee ?? 0,
              colorName: "",
              optionSelections: [],
              pakketilbudItems: (i.pakketilbudItems ?? []).map((c) => ({
                itemId: c.itemId,
                productId: c.productId,
                productName: c.productName.slice(0, 40),
                label: c.label ?? "",
                skuId: c.skuId,
                size: c.size,
                colorName: c.colorName ?? "",
                customName: c.customName ?? "",
                customNumber: c.customNumber ?? "",
              })),
            };
          }
          return {
            skuId: i.skuId,
            productName: i.productName ?? "",
            size: i.size ?? "",
            quantity: i.quantity,
            price: i.price,
            customName: i.customName ?? "",
            customNumber: i.customNumber ?? "",
            customizationFee: i.customizationFee ?? 0,
            colorName: i.colorName ?? "",
            optionSelections: i.printElements?.length
              ? { printElements: i.printElements }
              : (i.optionSelections ?? []),
          };
        }),
      ),
      shippingFee: String(shipping),
      isMember: String(isMember),
      deliveryMethod: effectiveDelivery,
      grantIds: JSON.stringify(appliedGrantIds),
      totalDiscountApplied: String(totalDiscountOre),
      vatRate: String(vatRate),
    },
    success_url: `${baseUrl}/ordre-bekraeftelse?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/kurv`,
    phone_number_collection: { enabled: true },
    billing_address_collection: "required",
    ...(isPickup ? {} : { shipping_address_collection: { allowed_countries: ["DK"] } }),
    locale: "da",
  });

  return NextResponse.json({ url: checkoutSession.url });
}
