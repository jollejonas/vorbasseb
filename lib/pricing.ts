export function getEffectivePrice(
  basePrice: number,
  salePrice: number | null | undefined,
  salePriceStart: Date | string | null | undefined,
  salePriceEnd: Date | string | null | undefined,
  now = new Date(),
): { effectivePrice: number; isOnSale: boolean } {
  if (salePrice != null && salePriceStart != null && salePriceEnd != null) {
    const start = new Date(salePriceStart);
    const end = new Date(salePriceEnd);
    // Set end to end-of-day so date-only values are inclusive
    end.setHours(23, 59, 59, 999);
    if (now >= start && now <= end) {
      return { effectivePrice: salePrice, isOnSale: true };
    }
  }
  return { effectivePrice: basePrice, isOnSale: false };
}
