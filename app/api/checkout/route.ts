import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { CartItem } from "@/components/shop/CartProvider";

export async function POST(req: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const session = await auth();
  const { items }: { items: CartItem[] } = await req.json();

  if (!items || items.length === 0) {
    return NextResponse.json({ error: "Tom kurv" }, { status: 400 });
  }

  // Read shipping rules and member discount from DB (fall back to defaults)
  const cfg = await prisma.siteSetting
    .findMany({ where: { key: { in: ["shipping_flat_ore", "shipping_free_ore", "member_discount_pct"] } } })
    .catch(() => []);
  const flatOre = parseInt(cfg.find((s) => s.key === "shipping_flat_ore")?.value ?? "4900");
  const freeOre = parseInt(cfg.find((s) => s.key === "shipping_free_ore")?.value ?? "49900");
  const discountPct = parseInt(cfg.find((s) => s.key === "member_discount_pct")?.value ?? "10");

  // Check if user is an active member (for discount)
  let isMember = false;
  if (session?.user?.id) {
    const sub = await prisma.subscription.findUnique({
      where: { userId: session.user.id },
    });
    isMember = sub?.status === "ACTIVE";
  }

  const subtotal = items.reduce(
    (s, i) => s + (i.price + (i.customizationFee ?? 0)) * i.quantity,
    0,
  );
  const shipping = subtotal >= freeOre ? 0 : flatOre;

  // Build Stripe line items
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map(
    (item) => ({
      price_data: {
        currency: "dkk",
        product_data: {
          name: `${item.productName} (${item.size})${
            item.customName || item.customNumber
              ? ` · Tryk: ${item.customName ?? ""} ${item.customNumber ?? ""}`.trim()
              : ""
          }`,
          images: item.image ? [item.image] : [],
        },
        unit_amount: item.price + (item.customizationFee ?? 0),
      },
      quantity: item.quantity,
    }),
  );

  // Shipping line item
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

  // Apply member discount via Stripe coupon (percentage read from DB)
  let discounts: Stripe.Checkout.SessionCreateParams["discounts"] = undefined;
  if (isMember) {
    const coupon = await stripe.coupons.create({
      percent_off: discountPct,
      duration: "once",
      name: `Fanklubsrabat ${discountPct}%`,
    });
    discounts = [{ coupon: coupon.id }];
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    discounts,
    customer_email: session?.user?.email ?? undefined,
    metadata: {
      userId: session?.user?.id ?? "",
      cartJson: JSON.stringify(
        items.map((i) => ({
          skuId: i.skuId,
          quantity: i.quantity,
          price: i.price,
          customName: i.customName ?? "",
          customNumber: i.customNumber ?? "",
          customizationFee: i.customizationFee ?? 0,
        })),
      ),
      shippingFee: String(shipping),
      isMember: String(isMember),
    },
    success_url: `${baseUrl}/ordre-bekraeftelse?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/kurv`,
    billing_address_collection: "required",
    shipping_address_collection: { allowed_countries: ["DK"] },
    locale: "da",
  });

  return NextResponse.json({ url: checkoutSession.url });
}
