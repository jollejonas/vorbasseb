import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { activeOrdersWhere } from "@/lib/active-orders";
import { csvCell } from "@/lib/bookkeeping-export";
import { purchaseLines } from "@/lib/purchase-summary";

const labels: Record<string, string> = {
  PAID: "Betalt", SHIPPED: "Afsendt", AWAITING_PICKUP: "Afventer afhentning",
  PICKUP_READY: "Klar til afhentning", DELIVERED: "Leveret",
};
const date = new Intl.DateTimeFormat("da-DK", { timeZone: "Europe/Copenhagen", dateStyle: "short" });
const kroner = (ore: number) => (ore / 100).toFixed(2).replace(".", ",");

export async function GET() {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") return new Response("Ingen adgang", { status: 403 });
  const orders = await prisma.order.findMany({
    where: activeOrdersWhere,
    orderBy: { orderNumber: "asc" },
    select: {
      orderNumber: true, status: true, refunded: true, createdAt: true, customerName: true,
      guestEmail: true, phone: true, total: true, shippingFee: true, deliveryMethod: true,
      user: { select: { name: true, email: true } },
      items: { select: {
        id: true, quantity: true, customName: true, customNumber: true, colorName: true, optionSelections: true,
        sku: { select: { id: true, size: true, itemNumber: true, product: { select: { name: true } } } },
      } },
    },
  });
  const rows: (string | number)[][] = [["Ordrenr.", "Dato", "Kunde", "E-mail", "Telefon", "Status", "Levering", "Varer (antal, størrelse og tilvalg)", "Fragt (kr.)", "Total inkl. moms (kr.)"]];
  for (const order of orders) {
    const products = purchaseLines([order]).map(line =>
      [line.quantity + " × " + line.product, line.size, line.color, line.print].filter(Boolean).join(" · ")
    );
    rows.push([order.orderNumber!, date.format(order.createdAt), order.customerName ?? order.user?.name ?? "",
      order.guestEmail ?? order.user?.email ?? "", order.phone ?? "", labels[order.status] ?? order.status,
      order.deliveryMethod === "PICKUP" ? "Afhentning" : "Forsendelse", products.join(" | "),
      kroner(order.shippingFee), kroner(order.total)]);
  }
  return new Response("\uFEFF" + rows.map(row => row.map(csvCell).join(";")).join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "private, no-store",
      "Content-Disposition": 'attachment; filename="VBK-aktive-ordrer.csv"' },
  });
}
