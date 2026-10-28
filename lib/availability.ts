/** Samlebestillinger are made to order and do not consume on-hand inventory. */
export function canPurchaseSku(
  product: { isGroupOrder: boolean },
  sku: { stock: number } | null | undefined,
  quantity = 1,
): boolean {
  return !!sku && Number.isSafeInteger(quantity) && quantity > 0 &&
    (product.isGroupOrder || sku.stock >= quantity);
}

export function tracksStock(product: { isGroupOrder: boolean }): boolean {
  return !product.isGroupOrder;
}
