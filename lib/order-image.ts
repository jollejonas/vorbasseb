/** Resolve the purchased SKU's colour before falling back to the product photo. */
export function orderImage(sku: {
  colorVariant?: { images: string[] } | null;
  optionValues?: { optionValue: { images: string[] } }[];
  product: { images: string[] };
} | null | undefined): string | undefined {
  return sku?.optionValues?.find(v => v.optionValue.images.length)?.optionValue.images[0]
    ?? sku?.colorVariant?.images[0]
    ?? sku?.product.images[0];
}
