import { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";
import { AdminOrderActions } from "@/components/admin/AdminOrderActions";

export const metadata: Metadata = { title: "Ordredetaljer – Admin" };

type Params = { params: Promise<{ id: string }> };

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Afventer",
  PAID: "Betalt",
  SHIPPED: "Afsendt",
  AWAITING_PICKUP: "Afventer afhentning",
  PICKUP_READY: "Klar til afhentning",
  DELIVERED: "Leveret",
  CANCELLED: "Annulleret",
  REFUNDED: "Refunderet",
};

export default async function AdminOrderDetailPage({ params }: Params) {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") redirect("/");

  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: {
        include: { sku: { include: { product: true } } },
      },
      shippingAddress: true,
      user: { select: { name: true, email: true, customerNumber: true } },
    },
  });

  if (!order) notFound();

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/admin/ordrer" className="text-sm text-gray-500 hover:text-secondary">
          ← Ordrer
        </Link>
        <h1 className="text-2xl font-bold">Ordre #{order.orderNumber}</h1>
        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
          {STATUS_LABELS[order.status] ?? order.status}
        </span>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* Customer info */}
        <section className="border rounded-xl p-5 space-y-2">
          <h2 className="font-semibold text-gray-700 mb-3">Kunde</h2>
          <p className="text-sm">
            <span className="text-gray-500">Navn: </span>
            {order.customerName ?? order.user?.name ?? "–"}
          </p>
          <p className="text-sm">
            <span className="text-gray-500">E-mail: </span>
            {order.guestEmail ?? order.user?.email ?? "–"}
          </p>
          <p className="text-sm">
            <span className="text-gray-500">Telefon: </span>
            {order.phone ?? "–"}
          </p>
          {order.user?.customerNumber && (
            <p className="text-sm">
              <span className="text-gray-500">Kundenr.: </span>
              <span className="font-mono">#{order.user.customerNumber}</span>
            </p>
          )}
          <p className="text-sm">
            <span className="text-gray-500">Levering: </span>
            {order.deliveryMethod === "PICKUP" ? "Afhentning ved klubben" : "Forsendelse"}
          </p>
        </section>

        {/* Shipping address */}
        <section className="border rounded-xl p-5 space-y-2">
          <h2 className="font-semibold text-gray-700 mb-3">Leveringsadresse</h2>
          {order.shippingAddress ? (
            <>
              <p className="text-sm">{order.shippingAddress.name}</p>
              <p className="text-sm">{order.shippingAddress.line1}</p>
              {order.shippingAddress.line2 && (
                <p className="text-sm">{order.shippingAddress.line2}</p>
              )}
              <p className="text-sm">
                {order.shippingAddress.postcode} {order.shippingAddress.city}
              </p>
              <p className="text-sm">{order.shippingAddress.country}</p>
            </>
          ) : (
            <p className="text-sm text-gray-400 italic">Ingen adresse gemt</p>
          )}
        </section>
      </div>

      {/* Order items */}
      <section className="border rounded-xl overflow-hidden mb-8">
        <div className="px-5 py-3 bg-gray-50 border-b">
          <h2 className="font-semibold text-gray-700">Produkter</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="px-5 py-2 font-medium">Produkt</th>
              <th className="px-5 py-2 font-medium">Varenr.</th>
              <th className="px-5 py-2 font-medium">Størrelse</th>
              <th className="px-5 py-2 font-medium">Farve</th>
              <th className="px-5 py-2 font-medium">Tryk</th>
              <th className="px-5 py-2 font-medium text-right">Antal</th>
              <th className="px-5 py-2 font-medium text-right">Pris</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {order.items.map((item) => (
              <tr key={item.id}>
                <td className="px-5 py-3">{item.sku.product.name}</td>
                <td className="px-5 py-3 font-mono text-xs text-gray-500">
                  {item.sku.itemNumber ?? "–"}
                </td>
                <td className="px-5 py-3">{item.sku.size}</td>
                <td className="px-5 py-3 text-gray-500">{item.colorName ?? "–"}</td>
                <td className="px-5 py-3 text-gray-500">
                  {item.customName || item.customNumber
                    ? [item.customName, item.customNumber ? `#${item.customNumber}` : null]
                        .filter(Boolean)
                        .join(" ")
                    : "–"}
                </td>
                <td className="px-5 py-3 text-right">{item.quantity}</td>
                <td className="px-5 py-3 text-right font-medium">
                  {formatPrice(item.priceAtPurchase * item.quantity)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Totals */}
      <section className="border rounded-xl p-5 mb-8 space-y-2 max-w-xs ml-auto">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Fragt</span>
          <span>{order.shippingFee === 0 ? "Gratis" : formatPrice(order.shippingFee)}</span>
        </div>
        {order.discountApplied > 0 && (
          <div className="flex justify-between text-sm text-green-600">
            <span>Rabat (fanklub)</span>
            <span>−{formatPrice(order.discountApplied)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold border-t pt-2">
          <span>Total</span>
          <span>{formatPrice(order.total)}</span>
        </div>
      </section>

      {/* Actions */}
      <section className="border rounded-xl p-5">
        <h2 className="font-semibold text-gray-700 mb-4">Status &amp; handling</h2>
        <AdminOrderActions
          orderId={order.id}
          initialStatus={order.status}
          initialTrackingNumber={order.trackingNumber}
          initialRefunded={order.refunded}
          deliveryMethod={order.deliveryMethod}
        />
      </section>
    </div>
  );
}
