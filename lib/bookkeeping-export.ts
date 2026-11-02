export const paidOrderStatuses = ["PAID", "SHIPPED", "AWAITING_PICKUP", "PICKUP_READY", "DELIVERED"];

function calendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Vælg en gyldig fra- og til-dato.");
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error("Ugyldig dato.");
  return date;
}

// Solve local midnight in Copenhagen, including DST changes, without relying
// on the server's timezone. The interval is inclusive of both calendar dates.
function midnight(date: Date) {
  const target = date.getTime();
  let candidate = target;
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Copenhagen", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(candidate);
    const n = (type: string) => Number(parts.find(p => p.type === type)!.value);
    const local = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second"));
    candidate += target - local;
  }
  return new Date(candidate);
}

export function exportPeriod(from: string, to: string) {
  const first = calendarDate(from), last = calendarDate(to);
  const days = (last.getTime() - first.getTime()) / 86400000;
  if (days < 0 || days > 365) throw new Error("Vælg en periode på højst 366 dage, hvor fra-datoen er før eller lig med til-datoen.");
  last.setUTCDate(last.getUTCDate() + 1);
  return { gte: midnight(first), lt: midnight(last) };
}

type ExportOrder = {
  id: string; orderNumber: number | null; createdAt: Date; status: string; refunded: boolean;
  total: number; discountApplied: number; shippingFee: number;
  stripePaymentId: string | null; stripeSessionId: string | null;
  groupOrderHoldUntil: Date | null; customerName: string | null;
  items: { quantity: number; optionSelections: unknown; sku: { size: string; product: { name: string } } | null }[];
};

export function isConfirmedOrder(order: Pick<ExportOrder, "orderNumber" | "status" | "stripePaymentId" | "refunded">) {
  return order.orderNumber !== null && order.status !== "PENDING" && (
    paidOrderStatuses.includes(order.status) || order.status === "REFUNDED" || order.refunded ||
    (order.status === "CANCELLED" && !!order.stripePaymentId)
  );
}

export const bookkeepingHeaders = [
  "Reference", "Ordrenummer", "Ordredato (dansk tid)", "Kunde", "Varer", "Antal", "Valuta",
  "Ordretotal inkl. moms efter rabat", "Rabat i alt (allerede fratrukket)", "Fragt inkl. moms (indgår i total)",
  "Status", "Refusion skal kontrolleres i Stripe", "Samlebestilling", "Stripe betalings-ID", "Stripe checkout-ID", "Internt ordre-ID", "Bemærkning",
];

function csvCell(value: string | number) {
  let text = String(value).replace(/[\r\n\t]/g, " ");
  // User-supplied names must never become spreadsheet formulas.
  if (/^\s*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
const amount = (ore: number) => (ore / 100).toFixed(2).replace(".", ",");

export function bookkeepingCsv(orders: ExportOrder[]) {
  const rows: (string | number)[][] = [bookkeepingHeaders];
  for (const order of orders.filter(isConfirmedOrder)) {
    const products = order.items.map(item => {
      const meta = item.optionSelections && typeof item.optionSelections === "object" && !Array.isArray(item.optionSelections)
        ? item.optionSelections as Record<string, unknown> : {};
      const name = typeof meta.pakketilbudName === "string" ? meta.pakketilbudName : item.sku?.product.name ?? "Slettet/ukendt produkt – se ordrebilag";
      return `${item.quantity} × ${name}${item.sku?.size ? ` (${item.sku.size})` : ""}`;
    }).join(" | ");
    const review = order.refunded || ["REFUNDED", "CANCELLED"].includes(order.status);
    rows.push([
      `VBK-${order.orderNumber}`, order.orderNumber!, new Intl.DateTimeFormat("da-DK", { timeZone: "Europe/Copenhagen", dateStyle: "short", timeStyle: "medium" }).format(order.createdAt),
      order.customerName ?? "", products, order.items.reduce((sum, item) => sum + item.quantity, 0), "DKK",
      amount(order.total), amount(order.discountApplied), amount(order.shippingFee), order.status,
      review ? "Ja – beløb og dato hentes i Stripe" : "Kontrollér også eventuelle refusioner foretaget direkte i Stripe",
      order.groupOrderHoldUntil ? "Ja – kontrollér forudbetaling/levering" : "Nej",
      order.stripePaymentId ?? "", order.stripeSessionId ?? "", order.id,
      "Oprindeligt ordrebeløb; refusioner er ikke fratrukket. Momsfordeling, Stripe-gebyrer og udbetalinger er ikke specificeret. Ikke en e-conomic-importfil.",
    ]);
  }
  return "\uFEFF" + rows.map(row => row.map(csvCell).join(";")).join("\r\n") + "\r\n";
}
