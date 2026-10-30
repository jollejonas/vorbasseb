import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { ensureStripeProduct } from "@/lib/stripe-products";
import { promoCodeSchema, promoExpiry, promoError } from "@/lib/promo-codes";

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw { type: "StripeAuthenticationError" };
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

export async function GET() {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const codes = await getStripe().promotionCodes.list({ limit: 50, active: true, expand: ["data.promotion.coupon"] });
    return NextResponse.json(codes.data);
  } catch (error) {
    const result = promoError(error);
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = promoCodeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { code, type, amount, expiryDate, oneTimePerCustomer, maxUses, productId, replacesSale } = parsed.data;
  let expires: number | undefined;
  if (expiryDate) {
    try { expires = promoExpiry(expiryDate); } catch { return NextResponse.json({ error: "Ugyldig udløbsdato." }, { status: 400 }); }
    if (expires <= Date.now() / 1000) return NextResponse.json({ error: "Udløbsdatoen skal ligge i fremtiden." }, { status: 400 });
  }
  let stripe: Stripe | undefined;
  let coupon: Stripe.Coupon | undefined;
  try {
    stripe = getStripe();
    const product = productId ? await prisma.product.findUnique({ where: { id: productId }, select: { id: true, name: true, images: true } }) : null;
    if (productId && !product) return NextResponse.json({ error: "Det valgte produkt findes ikke længere." }, { status: 400 });
    // Explicit eligibility lets checkout exclude sale items and shipping while
    // retaining Stripe's native redemption limits and expiry enforcement.
    const products = product ? [product] : await prisma.product.findMany({ select: { id: true, name: true, images: true } });
    const bundles = product ? [] : await prisma.pakketilbud.findMany({ select: { id: true, name: true } });
    const eligible = [...products, ...bundles.map(p => ({ ...p, id: `bundle_${p.id}` }))];
    if (!eligible.length) return NextResponse.json({ error: "Opret et produkt først." }, { status: 400 });
    const stripeIds: string[] = [];
    for (const p of eligible) stripeIds.push(await ensureStripeProduct(stripe, p));
    const metadata: Stripe.MetadataParam = {
      ...(product ? { shopProductId: product.id, shopProductName: product.name.slice(0, 500) } : { shopProductName: "Alle nuværende produkter og pakketilbud" }),
      replacesSale: String(replacesSale),
    };
    coupon = await stripe.coupons.create({
      ...(type === "percent" ? { percent_off: amount } : { amount_off: Math.round(amount * 100), currency: "dkk" }),
      duration: "once",
      ...(expires ? { redeem_by: expires } : {}),
      applies_to: { products: stripeIds },
      metadata,
    });
    const promo = await stripe.promotionCodes.create({
      promotion: { type: "coupon", coupon: coupon.id }, code, metadata,
      ...(expires ? { expires_at: expires } : {}),
      ...(oneTimePerCustomer ? { restrictions: { first_time_transaction: true } } : {}),
      ...(maxUses ? { max_redemptions: maxUses } : {}),
    });
    return NextResponse.json({ id: promo.id, code: promo.code });
  } catch (error) {
    // Do not leave an unused coupon behind after a rejected promotion code.
    if (coupon && stripe && (error as { type?: string }).type === "StripeInvalidRequestError") await stripe.coupons.del(coupon.id).catch(() => {});
    const result = promoError(error);
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
}
