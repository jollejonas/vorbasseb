/** Customer shipping charge in øre, inclusive of VAT. Independent of basket discounts. */
export const SHIPPING_PRICE_ORE = 4900;
export function shippingPrice(delivery: "SHIPPING" | "PICKUP") {
  return delivery === "PICKUP" ? 0 : SHIPPING_PRICE_ORE;
}
