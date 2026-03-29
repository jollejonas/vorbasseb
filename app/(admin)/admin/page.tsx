import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";
import Link from "next/link";
import { AlertTriangle, ShoppingBag, Users, TrendingUp, Package } from "lucide-react";

export const metadata: Metadata = { title: "Admin" };

type AttentionReason = "empty" | "low" | "images";

type AttentionProduct = {
  id: string;
  name: string;
  reasons: AttentionReason[];
};

function getAttentionProducts(
  products: {
    id: string;
    name: string;
    images: string[];
    skus: { stock: number }[];
    colorVariants: { images: string[] }[];
  }[]
): AttentionProduct[] {
  const result: AttentionProduct[] = [];
  for (const p of products) {
    const stocks = p.skus.map((s) => s.stock);
    const totalStock = stocks.reduce((a, b) => a + b, 0);
    const hasSkus = stocks.length > 0;
    const emptyStock = hasSkus && totalStock === 0;
    const lowStock = hasSkus && !emptyStock && stocks.some((s) => s > 0 && s <= 2);
    const hasImages = p.images.length > 0 || p.colorVariants.some((cv) => cv.images.length > 0);

    const reasons: AttentionReason[] = [];
    if (emptyStock) reasons.push("empty");
    if (lowStock) reasons.push("low");
    if (!hasImages) reasons.push("images");

    if (reasons.length > 0) result.push({ id: p.id, name: p.name, reasons });
  }
  return result;
}

const REASON_LABEL: Record<AttentionReason, string> = {
  empty: "Tomt lager",
  low: "Lavt lager",
  images: "Mangler billeder",
};

const REASON_STYLE: Record<AttentionReason, string> = {
  empty: "bg-red-100 text-red-700",
  low: "bg-amber-100 text-amber-700",
  images: "bg-gray-100 text-gray-600",
};

export default async function AdminPage() {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") redirect("/");

  const [pendingOrderCount, orderCount, activeMembers, revenue, recentOrders, allProducts] =
    await Promise.all([
      prisma.order.count({ where: { status: "PAID" } }),
      prisma.order.count({ where: { status: { in: ["PAID", "SHIPPED"] } } }),
      prisma.subscription.count({ where: { status: "ACTIVE" } }),
      prisma.order.aggregate({
        where: { status: { in: ["PAID", "SHIPPED", "DELIVERED"] } },
        _sum: { total: true },
      }),
      prisma.order.findMany({
        where: { status: { in: ["PAID", "PENDING"] } },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          orderNumber: true,
          total: true,
          status: true,
          createdAt: true,
          customerName: true,
          guestEmail: true,
          user: { select: { name: true, email: true } },
        },
      }),
      prisma.product.findMany({
        where: { published: true },
        select: {
          id: true,
          name: true,
          images: true,
          skus: { select: { stock: true } },
          colorVariants: { select: { images: true } },
        },
      }),
    ]);

  const attentionProducts = getAttentionProducts(allProducts);

  const stats = [
    { label: "Ubehandlede ordrer", value: pendingOrderCount, icon: ShoppingBag, href: "/admin/ordrer", highlight: pendingOrderCount > 0 },
    { label: "Aktive ordrer i alt", value: orderCount, icon: Package, href: "/admin/ordrer", highlight: false },
    { label: "Fanklubsmedlemmer", value: activeMembers, icon: Users, href: null, highlight: false },
    { label: "Samlet omsætning", value: formatPrice(revenue._sum.total ?? 0), icon: TrendingUp, href: null, highlight: false },
  ];

  const STATUS_LABEL: Record<string, string> = {
    PAID: "Betalt",
    PENDING: "Afventer",
    SHIPPED: "Afsendt",
    DELIVERED: "Leveret",
    CANCELLED: "Annulleret",
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-8">Overblik</h1>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {stats.map((s) => (
          <div
            key={s.label}
            className={`rounded-xl p-5 border ${s.highlight ? "bg-amber-50 border-amber-200" : "bg-white border-gray-100"} shadow-sm`}
          >
            <s.icon size={20} className={`mb-3 ${s.highlight ? "text-amber-500" : "text-secondary"}`} />
            <p className={`text-2xl font-bold ${s.highlight ? "text-amber-700" : ""}`}>{s.value}</p>
            <p className="text-sm text-gray-500 mt-1">{s.label}</p>
            {s.href && (
              <a href={s.href} className="text-xs text-secondary underline mt-2 inline-block">
                Se alle →
              </a>
            )}
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent orders */}
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <h2 className="font-semibold text-sm">Seneste ordrer</h2>
            <Link href="/admin/ordrer" className="text-xs text-secondary underline">Se alle</Link>
          </div>
          {recentOrders.length === 0 ? (
            <p className="text-sm text-gray-400 px-5 py-6">Ingen ordrer endnu.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {recentOrders.map((o) => {
                const name = o.customerName ?? o.user?.name ?? o.guestEmail ?? "Gæst";
                return (
                  <li key={o.id}>
                    <Link
                      href={`/admin/ordrer/${o.id}`}
                      className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition"
                    >
                      <div>
                        <p className="text-sm font-medium">#{o.orderNumber} · {name}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(o.createdAt).toLocaleDateString("da-DK")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{formatPrice(o.total)}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          o.status === "PAID" ? "bg-green-100 text-green-700" :
                          o.status === "PENDING" ? "bg-amber-100 text-amber-700" :
                          "bg-gray-100 text-gray-600"
                        }`}>
                          {STATUS_LABEL[o.status] ?? o.status}
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Attention products */}
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <AlertTriangle size={15} className="text-amber-500" />
              Kræver opmærksomhed
              {attentionProducts.length > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                  {attentionProducts.length}
                </span>
              )}
            </h2>
            <Link href="/admin/produkter?filter=attention" className="text-xs text-secondary underline">
              Se alle
            </Link>
          </div>
          {attentionProducts.length === 0 ? (
            <p className="text-sm text-gray-400 px-5 py-6">Alt ser godt ud! 🎉</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {attentionProducts.slice(0, 6).map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/admin/produkter/${p.id}`}
                    className="flex items-start justify-between gap-3 px-5 py-3 hover:bg-gray-50 transition"
                  >
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <div className="flex gap-1 flex-wrap justify-end shrink-0">
                      {p.reasons.map((r) => (
                        <span key={r} className={`text-xs px-2 py-0.5 rounded-full font-medium ${REASON_STYLE[r]}`}>
                          {REASON_LABEL[r]}
                        </span>
                      ))}
                    </div>
                  </Link>
                </li>
              ))}
              {attentionProducts.length > 6 && (
                <li className="px-5 py-3">
                  <Link href="/admin/produkter?filter=attention" className="text-xs text-secondary underline">
                    + {attentionProducts.length - 6} flere produkter
                  </Link>
                </li>
              )}
            </ul>
          )}
        </div>
      </div>

      {/* Quick links */}
      <div className="mt-6 flex gap-4 text-sm">
        <Link href="/admin/kategorier" className="text-secondary underline">Kategorier</Link>
        <Link href="/admin/farver" className="text-secondary underline">Farver</Link>
      </div>
    </div>
  );
}
