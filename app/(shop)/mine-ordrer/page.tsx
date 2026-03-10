import { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Mine ordrer" };

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Afventer",
  PAID: "Betalt",
  SHIPPED: "Afsendt",
  AWAITING_PICKUP: "Klar til afhentning",
  PICKUP_READY: "Klar til afhentning",
  DELIVERED: "Leveret",
  CANCELLED: "Annulleret",
  REFUNDED: "Refunderet",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  PAID: "bg-blue-100 text-blue-800",
  SHIPPED: "bg-purple-100 text-purple-800",
  AWAITING_PICKUP: "bg-orange-100 text-orange-800",
  PICKUP_READY: "bg-green-100 text-green-700",
  DELIVERED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-700",
  REFUNDED: "bg-gray-100 text-gray-600",
};

export default async function MineOrdrerPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const orders = await prisma.order.findMany({
    where: { userId: session.user.id },
    include: {
      items: {
        include: { sku: { include: { product: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-8">Mine ordrer</h1>

      {orders.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-500 mb-4">Du har endnu ingen ordrer.</p>
          <a
            href="/butik"
            className="text-secondary underline hover:text-secondary-dark"
          >
            Gå til butikken
          </a>
        </div>
      ) : (
        <ul className="space-y-4">
          {orders.map((order) => (
            <li
              key={order.id}
              className="border border-gray-100 rounded-xl p-5"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-xs text-gray-400">
                    {new Intl.DateTimeFormat("da-DK", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    }).format(new Date(order.createdAt))}
                  </p>
                  <p className="font-semibold text-sm mt-0.5">
                    {formatPrice(order.total)}
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold px-3 py-1 rounded-full ${
                    STATUS_COLORS[order.status] ?? "bg-gray-100"
                  }`}
                >
                  {STATUS_LABELS[order.status] ?? order.status}
                </span>
              </div>

              <ul className="text-sm text-gray-600 space-y-1">
                {order.items.map((item) => (
                  <li key={item.id}>
                    {item.quantity}× {item.sku?.product.name ?? "–"} ({item.sku?.size ?? "–"})
                    {item.colorName && ` · ${item.colorName}`}
                    {item.customName && ` · ${item.customName}`}
                    {item.customNumber && ` #${item.customNumber}`}
                    {(item.optionSelections as { groupLabel: string; value: string }[] | null)?.map(
                      (s, i) => <span key={i}> · {s.value}</span>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
