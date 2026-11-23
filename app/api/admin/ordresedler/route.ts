import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { activeOrdersWhere } from "@/lib/active-orders";
import { purchaseLines } from "@/lib/purchase-summary";
import { orderImage } from "@/lib/order-image";
import { orderVat } from "@/lib/order-vat";
import { readOrderVatRates } from "@/lib/order-vat-storage";

export async function GET() {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") return new Response("Ingen adgang", { status: 403 });
  const skuFields = { id: true, size: true, itemNumber: true, product: { select: { name: true, images: true } },
    optionValues: { select: { optionValue: { select: { images: true } } } }, colorVariant: { select: { images: true } } } as const;
  const orders = await prisma.order.findMany({ where: activeOrdersWhere, orderBy: { orderNumber: "asc" },
    include: { shippingAddress: true, user: { select: { name: true, email: true, customerNumber: true } }, items: { include: { sku: { select: skuFields } } } } });
  const ids = new Set<string>();
  for (const order of orders) for (const item of order.items) {
    const bundle = item.optionSelections as { items?: { skuId?: string }[] } | null;
    if (Array.isArray(bundle?.items)) for (const part of bundle.items) if (part?.skuId) ids.add(part.skuId);
  }
  const components = ids.size ? await prisma.sKU.findMany({ where: { id: { in: [...ids] } }, select: skuFields }) : [];
  const photos = new Map(components.map(s => [s.id, orderImage(s)]));
  const rates = await readOrderVatRates(prisma, orders.map(order => order.id));
  const slips = [];
  for (const order of orders) {
    const address = order.shippingAddress;
    slips.push({ number: order.orderNumber!, date: order.createdAt.toISOString(), status: order.status,
      customer: order.customerName ?? order.user?.name ?? "", email: order.guestEmail ?? order.user?.email ?? "", phone: order.phone ?? "",
      pickup: order.deliveryMethod === "PICKUP", customerNumber: order.user?.customerNumber,
      address: address ? [address.name, address.line1, address.line2, [address.postcode, address.city].filter(Boolean).join(" "), address.country].filter(Boolean).join("\n") : "",
      hold: order.groupOrderHoldUntil?.toISOString(), shipping: order.shippingFee, discount: order.discountApplied,
      amounts: orderVat(order.total, rates.get(order.id) ?? 25),
      items: order.items.flatMap(item => {
        const bundle = item.optionSelections as { pakketilbudName?: string } | null;
        const lines = purchaseLines([{ ...order, items: [item] }], components);
        return lines.map((line, index) => ({ ...line, bundle: bundle?.pakketilbudName, photo: photos.get(line.skuId) ?? orderImage(item.sku),
          amount: index === 0 ? item.priceAtPurchase * item.quantity : null }));
      }) });
  }
  return Response.json(slips, { headers: { "Cache-Control": "private, no-store" } });
}
