export type PurchaseLine = {
  orderNumber: number; status: string; date: string; skuId: string; product: string;
  itemNumber: string; size: string; color: string; print: string; quantity: number;
};
type Sku = { id: string; size: string; itemNumber: string | null; product: { name: string } };
type Order = { orderNumber: number | null; status: string; refunded: boolean; createdAt: Date; items: {
  id: string; sku: Sku | null; quantity: number; colorName: string | null;
  customName: string | null; customNumber: string | null; optionSelections: unknown;
}[] };
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function text(value: unknown) { return typeof value === "string" ? value : ""; }
function printing(meta: Record<string, unknown>, customName?: string | null, customNumber?: string | null) {
  return [customName && `Navn: ${customName}`, customNumber && `Nummer: ${customNumber}`,
    ...(Array.isArray(meta.printElements) ? meta.printElements.map(value => {
      const p = record(value); return `${text(p.zoneLabel)}: ${p.type === "text" ? text(p.value) : `Logo ${text(p.value)}`}`;
    }) : [])].filter(Boolean).join(" · ");
}
export function purchaseLines(orders: Order[], componentSkus: Sku[] = []): PurchaseLine[] {
  const skus = new Map(componentSkus.map(sku => [sku.id, sku]));
  return orders.filter(order => order.orderNumber != null && !order.refunded && ["PAID", "SHIPPED", "AWAITING_PICKUP", "PICKUP_READY", "DELIVERED"].includes(order.status)).flatMap(order => {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Copenhagen", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(order.createdAt);
    const day = (type: string) => parts.find(p => p.type === type)?.value;
    const base = { orderNumber: order.orderNumber!, status: order.status, date: `${day("year")}-${day("month")}-${day("day")}` };
    return order.items.flatMap(item => {
      const meta = record(item.optionSelections);
      if (meta.isPakketilbud === true && Array.isArray(meta.items) && meta.items.length > 0) {
        return meta.items.map((value, index) => {
          const c = record(value), sku = skus.get(text(c.skuId));
          return { ...base, skuId: text(c.skuId) || `${item.id}:${index}`, product: text(c.productName) || sku?.product.name || "Ukendt produkt — kontrollér ordren", itemNumber: sku?.itemNumber || "", size: text(c.size) || sku?.size || "", color: text(c.colorName), print: printing(c, text(c.customName), text(c.customNumber)), quantity: item.quantity };
        });
      }
      const options = Array.isArray(item.optionSelections) ? item.optionSelections.map(value => { const s = record(value); return `${text(s.groupLabel)}: ${text(s.value)}`; }).join(" · ") : "";
      return [{ ...base, skuId: item.sku?.id || item.id, product: item.sku?.product.name || "Ukendt produkt — kontrollér ordren", itemNumber: item.sku?.itemNumber || "", size: item.sku?.size || "", color: item.colorName || "", print: [printing(meta, item.customName, item.customNumber), options].filter(Boolean).join(" · "), quantity: item.quantity }];
    });
  });
}
function sizeOrder(a: string, b: string) {
  const sizes = ["XXXS", "XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL", "6XL"];
  const normalized = (s: string) => s.toUpperCase().replace(/^2XL$/, "XXL").replace(/^XXXL$/, "3XL");
  const left = sizes.indexOf(normalized(a)), right = sizes.indexOf(normalized(b));
  return left >= 0 && right >= 0 ? left - right : a.localeCompare(b, "da", { numeric: true });
}
export function summarizePurchases(lines: PurchaseLine[]) {
  const groups = new Map<string, PurchaseLine & { orders: number[] }>();
  for (const line of lines) {
    const key = JSON.stringify([line.skuId, line.product, line.itemNumber, line.size, line.color, line.print]);
    const existing = groups.get(key);
    if (existing) { existing.quantity += line.quantity; if (!existing.orders.includes(line.orderNumber)) existing.orders.push(line.orderNumber); }
    else groups.set(key, { ...line, orders: [line.orderNumber] });
  }
  return [...groups.values()].sort((a, b) => a.product.localeCompare(b.product, "da") || a.color.localeCompare(b.color, "da") || sizeOrder(a.size, b.size) || a.print.localeCompare(b.print, "da"));
}
export const purchaseHeaders = ["Produkt", "Varenummer", "Størrelse", "Farve", "Tryk / tilvalg", "Antal", "Ordrer"];
export function purchaseCells(rows: ReturnType<typeof summarizePurchases>): (string | number)[][] {
  return [purchaseHeaders, ...rows.map(row => [row.product, row.itemNumber, row.size, row.color, row.print, row.quantity, row.orders.map(n => `#${n}`).join(", ")])];
}
function safeCell(value: string | number) {
  const text = String(value).replace(/[\t\r\n]/g, " ");
  return /^[\s]*[=+@-]/.test(text) ? `'${text}` : text;
}
export function purchaseCsv(rows: ReturnType<typeof summarizePurchases>) {
  return "\uFEFF" + purchaseCells(rows).map(row => row.map(value => `"${safeCell(value).replace(/"/g, '""')}"`).join(";")).join("\r\n");
}
export function purchaseClipboard(rows: ReturnType<typeof summarizePurchases>) {
  return purchaseCells(rows).map(row => row.map(safeCell).join("\t")).join("\n");
}
