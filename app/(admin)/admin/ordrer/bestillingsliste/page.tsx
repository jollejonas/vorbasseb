import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { purchaseLines } from "@/lib/purchase-summary";
import { PurchaseSummary } from "@/components/admin/PurchaseSummary";

export default async function PurchaseSummaryPage() {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") redirect("/");
  const orders = await prisma.order.findMany({
    where: { orderNumber: { not: null }, refunded: false, status: { in: ["PAID", "SHIPPED", "AWAITING_PICKUP", "PICKUP_READY", "DELIVERED"] } },
    include: { items: { include: { sku: { include: { product: { select: { name: true } } } } } } },
    orderBy: { createdAt: "desc" },
  });
  const componentIds = orders.flatMap(order => order.items.flatMap(item => {
    const meta = item.optionSelections as { isPakketilbud?: boolean; items?: { skuId?: string }[] } | null;
    return meta?.isPakketilbud && Array.isArray(meta.items) ? meta.items.flatMap(c => c.skuId ? [c.skuId] : []) : [];
  }));
  const components = componentIds.length ? await prisma.sKU.findMany({ where: { id: { in: componentIds } }, include: { product: { select: { name: true } } } }) : [];
  return <PurchaseSummary lines={purchaseLines(orders, components)} />;
}
