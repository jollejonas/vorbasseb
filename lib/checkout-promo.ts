import type Stripe from "stripe";

export async function resolveCheckoutPromo(stripe: Stripe, code: string) {
  if (!/^[A-Z0-9]{1,100}$/.test(code)) throw new Error("Indtast en gyldig rabatkode.");
  const result = await stripe.promotionCodes.list({ code, active: true, limit: 1, expand: ["data.promotion.coupon"] });
  const promo = result.data[0];
  if (!promo || !promo.active || (promo.expires_at && promo.expires_at <= Date.now() / 1000)
    || (promo.max_redemptions !== null && promo.times_redeemed >= promo.max_redemptions)) {
    throw new Error("Rabatkoden er ugyldig, udløbet eller brugt op.");
  }
  const coupon = promo.promotion.coupon;
  if (!coupon || typeof coupon === "string" || !coupon.valid
    || (coupon.amount_off !== null && coupon.currency !== "dkk")) {
    throw new Error("Rabatkoden kan ikke bruges til denne ordre.");
  }
  return { promo, coupon, replacesSale: promo.metadata?.replacesSale === "true" };
}

export type CheckoutPromo = Awaited<ReturnType<typeof resolveCheckoutPromo>>;

export function promoApplies(promo: CheckoutPromo, stripeProductId: string, onSale: boolean) {
  const products = promo.coupon.applies_to?.products;
  return (!products || products.includes(stripeProductId)) && (!onSale || promo.replacesSale);
}

export function promoDiscount(promo: CheckoutPromo, eligibleLineTotals: number[]) {
  const subtotal = eligibleLineTotals.reduce((sum, total) => sum + total, 0);
  if (promo.coupon.percent_off !== null) {
    return eligibleLineTotals.reduce((sum, total) => sum + Math.round(total * promo.coupon.percent_off! / 100), 0);
  }
  return Math.min(subtotal, promo.coupon.amount_off ?? 0);
}
