import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";
import { OrderStatusSelect } from "@/components/admin/OrderStatusSelect";
export const metadata: Metadata = { title: "Ordrer – Admin" };

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Afventer",
  PAID: "Betalt",
  SHIPPED: "Afsendt",
  DELIVERED: "Leveret",
  REFUNDED: "Refunderet",
};

export default async function AdminOrdrerPage() {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") redirect("/");

  const orders = await prisma.order.findMany({
    include: {
      items: {
        include: { sku: { include: { product: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  type OrderWithItems = (typeof orders)[number];

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center gap-4 mb-8">
        <a href="/admin" className="text-sm text-gray-500 hover:text-secondary">
          ← Admin
        </a>
        <h1 className="text-3xl font-bold">Ordrer</h1>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="pb-3 pr-4 font-medium">Dato</th>
              <th className="pb-3 pr-4 font-medium">Kunde</th>
              <th className="pb-3 pr-4 font-medium">Produkter</th>
              <th className="pb-3 pr-4 font-medium">Total</th>
              <th className="pb-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.map((order: OrderWithItems) => (
              <tr key={order.id}>
                <td className="py-4 pr-4 text-gray-500 whitespace-nowrap">
                  {new Intl.DateTimeFormat("da-DK").format(
                    new Date(order.createdAt),
                  )}
                </td>
                <td className="py-4 pr-4">
                  {order.guestEmail ?? order.userId ?? "–"}
                </td>
                <td className="py-4 pr-4">
                  <ul className="space-y-0.5">
                    {order.items.map((item) => (
                      <li key={item.id} className="text-gray-600">
                        {item.quantity}× {item.sku.product.name} ({item.sku.size}
                        )
                      </li>
                    ))}
                  </ul>
                </td>
                <td className="py-4 pr-4 font-medium">
                  {formatPrice(order.total)}
                </td>
                <td className="py-4">
                  <OrderStatusSelect
                    orderId={order.id}
                    currentStatus={order.status}
                    labels={STATUS_LABELS}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
