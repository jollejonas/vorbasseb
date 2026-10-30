import type Stripe from "stripe";

// The same identity is used for coupon restrictions and every checkout.
export function stripeProductId(productId: string) {
  return `vbk_${productId}`;
}

export async function ensureStripeProduct(stripe: Stripe, product: { id: string; name: string; images?: string[] }) {
  const id = stripeProductId(product.id);
  try {
    await stripe.products.retrieve(id);
  } catch (error) {
    if ((error as { code?: string }).code !== "resource_missing") throw error;
    try {
      await stripe.products.create({ id, name: product.name, images: (product.images ?? []).filter(url => url.startsWith("https://")).slice(0, 8), metadata: { shopProductId: product.id } });
    } catch (createError) {
      // Another checkout may have created the same product concurrently.
      if ((createError as { code?: string }).code !== "resource_already_exists") throw createError;
      await stripe.products.retrieve(id);
    }
  }
  return id;
}
