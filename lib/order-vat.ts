/** Split the final gross total (after discounts, including shipping) in øre. */
export function orderVat(total: number, rate = 25) {
  if (!Number.isSafeInteger(total) || total < 0 || !Number.isFinite(rate) || rate < 0 || rate > 100) throw new Error("Invalid order VAT input");
  const net = Math.round(total * 100 / (100 + rate));
  return { net, vat: total - net, gross: total, rate };
}
