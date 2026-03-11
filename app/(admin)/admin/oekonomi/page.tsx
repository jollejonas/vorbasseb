import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { OekonomiClient } from "@/components/admin/OekonomiClient";

export const metadata: Metadata = { title: "Økonomi – Admin" };

type Props = { searchParams: Promise<{ period?: string }> };

export default async function OekonomiPage({ searchParams }: Props) {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") redirect("/");

  const { period = "all" } = await searchParams;

  const since =
    period === "30d"
      ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      : period === "1y"
      ? new Date(new Date().getFullYear(), 0, 1)
      : null;

  const [products, orders, pakketilbudList] = await Promise.all([
    prisma.product.findMany({
      include: { skus: true },
      orderBy: { name: "asc" },
    }),
    prisma.order.findMany({
      where: {
        status: "DELIVERED",
        ...(since ? { createdAt: { gte: since } } : {}),
      },
      select: { total: true },
    }),
    prisma.pakketilbud.findMany({
      include: {
        items: {
          include: { product: { include: { skus: { select: { costPrice: true } } } } },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const productRows = products.map((p) => {
    const skusWithCost = p.skus.filter((s) => s.costPrice !== null);
    const avgCostOre =
      skusWithCost.length > 0
        ? Math.round(
            skusWithCost.reduce((sum, s) => sum + s.costPrice!, 0) /
              skusWithCost.length
          )
        : null;
    const marginOre = avgCostOre !== null ? p.price - avgCostOre : null;
    const marginPct =
      marginOre !== null && p.price > 0
        ? (marginOre / p.price) * 100
        : null;
    return {
      id: p.id,
      name: p.name,
      priceOre: p.price,
      avgCostOre,
      marginOre,
      marginPct,
      skusWithCost: skusWithCost.length,
      totalSkus: p.skus.length,
      skus: p.skus.map((s) => ({ size: s.size, costPrice: s.costPrice })),
    };
  });

  const pakketilbudRows = pakketilbudList.map((p) => {
    const itemCosts = p.items.map((item) => {
      const skusWithCost = item.product.skus.filter((s) => s.costPrice !== null);
      return skusWithCost.length > 0
        ? Math.round(skusWithCost.reduce((sum, s) => sum + s.costPrice!, 0) / skusWithCost.length)
        : null;
    });
    const allHaveCost = itemCosts.every((c) => c !== null);
    const totalCostOre = allHaveCost ? itemCosts.reduce((sum, c) => sum + c!, 0) : null;
    const marginOre = totalCostOre !== null ? p.price - totalCostOre : null;
    const marginPct = marginOre !== null && p.price > 0 ? (marginOre / p.price) * 100 : null;
    return {
      id: p.id,
      name: p.name,
      priceOre: p.price,
      totalCostOre,
      marginOre,
      marginPct,
      itemCount: p.items.length,
      itemsWithCost: itemCosts.filter((c) => c !== null).length,
    };
  });

  const totalRevenueOre = orders.reduce((sum, o) => sum + o.total, 0);
  const antalOrdrer = orders.length;
  const gnsOrdrevaerdiOre =
    antalOrdrer > 0 ? Math.round(totalRevenueOre / antalOrdrer) : 0;

  const rowsWithMargin = productRows.filter((r) => r.marginPct !== null);
  const gnsAvancePct =
    rowsWithMargin.length > 0
      ? rowsWithMargin.reduce((sum, r) => sum + r.marginPct!, 0) /
        rowsWithMargin.length
      : null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center gap-4 mb-8">
        <a href="/admin" className="text-sm text-gray-500 hover:text-secondary">
          ← Admin
        </a>
        <h1 className="text-3xl font-bold">Økonomi</h1>
      </div>
      <OekonomiClient
        productRows={productRows}
        pakketilbudRows={pakketilbudRows}
        kpis={{ totalRevenueOre, antalOrdrer, gnsOrdrevaerdiOre, gnsAvancePct }}
        period={period}
      />
    </div>
  );
}
