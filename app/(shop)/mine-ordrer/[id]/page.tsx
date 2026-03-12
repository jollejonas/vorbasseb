import { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = { title: "Ordredetaljer" };

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Afventer betaling",
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

type Params = { params: Promise<{ id: string }> };

export default async function OrderDetailPage({ params }: Params) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  const [order, cfg] = await Promise.all([
    prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: { sku: { include: { product: { select: { name: true } } } } },
        },
        shippingAddress: true,
      },
    }),
    prisma.siteSetting
      .findMany({ where: { key: { in: ["vat_rate", "footer_email"] } } })
      .catch(() => []),
  ] as const);

  // Security: order must exist and belong to this user
  if (!order || order.userId !== session.user.id) notFound();

  const vatPct = parseInt(cfg.find((s) => s.key === "vat_rate")?.value ?? "25");
  const contactEmail = cfg.find((s) => s.key === "footer_email")?.value ?? "info@vorbassebk.dk";

  const date = new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(order.createdAt));

  const isPickup = order.deliveryMethod === "PICKUP";

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">
      {/* Back nav */}
      <Link href="/mine-ordrer" className="text-sm text-gray-500 hover:text-secondary inline-flex items-center gap-1">
        ← Mine ordrer
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs text-gray-400 mb-1">{date}</p>
          <h1 className="text-2xl font-bold">Ordre</h1>
          <p className="text-xs text-gray-400 font-mono mt-1">{order.id}</p>
        </div>
        <span
          className={`text-sm font-semibold px-4 py-1.5 rounded-full ${
            STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-600"
          }`}
        >
          {STATUS_LABELS[order.status] ?? order.status}
        </span>
      </div>

      {/* Items */}
      <section className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="bg-gray-50 border-b border-gray-200 px-5 py-3">
          <p className="text-sm font-semibold text-gray-700">Produkter</p>
        </div>
        <ul className="divide-y divide-gray-100">
          {order.items.map((item) => {
            const priceInclVat = Math.round(item.priceAtPurchase * (1 + vatPct / 100));
            const opts = item.optionSelections;

            // Pakketilbud
            if (opts && typeof opts === "object" && !Array.isArray(opts) && (opts as { isPakketilbud?: boolean }).isPakketilbud) {
              type PrintEl = { zoneLabel: string; side: string; type: string; value: string };
              const meta = opts as {
                pakketilbudName: string;
                items: { label?: string; productName?: string; size?: string; colorName?: string; customName?: string; customNumber?: string; printElements?: PrintEl[] }[];
              };
              return (
                <li key={item.id} className="px-5 py-4">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">
                        {item.quantity}× {meta.pakketilbudName}
                        <span className="ml-2 text-xs bg-secondary/10 text-secondary px-2 py-0.5 rounded-full font-normal">Pakketilbud</span>
                      </p>
                      <ul className="mt-1.5 space-y-0.5">
                        {meta.items.map((comp, i) => (
                          <li key={i} className="text-xs text-gray-500 flex items-center gap-1.5">
                            <span className="w-1 h-1 bg-gray-300 rounded-full shrink-0" />
                            {comp.label ?? comp.productName ?? "–"}
                            {comp.size && <span className="text-gray-400">({comp.size})</span>}
                            {comp.colorName && <span className="text-gray-400">· {comp.colorName}</span>}
                            {comp.customName && <span className="text-gray-400">· {comp.customName}</span>}
                            {comp.customNumber && <span className="text-gray-400">#{comp.customNumber}</span>}
                            {comp.printElements && comp.printElements.length > 0 && (
                              <span className="text-gray-400">· {comp.printElements.map((p) => p.type === "text" ? `${p.zoneLabel}: ${p.value}` : `${p.zoneLabel}: Logo`).join(", ")}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <p className="text-sm font-medium text-gray-700 shrink-0 tabular-nums">
                      {formatPrice(priceInclVat * item.quantity)}
                    </p>
                  </div>
                </li>
              );
            }

            // Regular item
            const printMeta = opts && typeof opts === "object" && !Array.isArray(opts) && (opts as { printElements?: unknown[] }).printElements
              ? (opts as { printElements: { zoneLabel: string; side: string; type: string; value?: string }[] }).printElements
              : null;
            const selectionMeta = Array.isArray(opts)
              ? (opts as { groupLabel: string; value: string }[])
              : null;

            return (
              <li key={item.id} className="px-5 py-4">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">
                      {item.quantity}× {item.sku?.product.name ?? "–"}
                    </p>
                    <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                      {item.sku?.size && <span>{item.sku.size}</span>}
                      {item.colorName && <span>{item.colorName}</span>}
                      {item.customName && <span>Tryk: {item.customName}</span>}
                      {item.customNumber && <span>#{item.customNumber}</span>}
                      {selectionMeta?.map((s, i) => <span key={i}>{s.value}</span>)}
                      {printMeta && printMeta.length > 0 && (
                        <span>
                          Tryk: {printMeta.map((p) => `${p.zoneLabel} (${p.type === "text" ? p.value : "logo"})`).join(", ")}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm font-medium text-gray-700 shrink-0 tabular-nums">
                    {formatPrice(priceInclVat * item.quantity)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>

        {/* Totals */}
        <div className="border-t border-gray-200 bg-gray-50 px-5 py-4 space-y-1.5 text-sm">
          {order.discountApplied > 0 && (
            <div className="flex justify-between text-green-700">
              <span>Rabat</span>
              <span className="tabular-nums">−{formatPrice(order.discountApplied)}</span>
            </div>
          )}
          {order.shippingFee > 0 && (
            <div className="flex justify-between text-gray-500">
              <span>Fragt</span>
              <span className="tabular-nums">{formatPrice(order.shippingFee)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-gray-900 pt-1 border-t border-gray-200">
            <span>Total (inkl. moms)</span>
            <span className="tabular-nums">{formatPrice(order.total)}</span>
          </div>
        </div>
      </section>

      {/* Delivery */}
      <section className="border border-gray-200 rounded-xl p-5 space-y-3">
        <p className="text-sm font-semibold text-gray-700">Levering</p>
        <p className="text-sm text-gray-600">{isPickup ? "Afhentning" : "Forsendelse (Danmark)"}</p>
        {order.shippingAddress && (
          <address className="not-italic text-sm text-gray-600 leading-relaxed">
            <p className="font-medium">{order.shippingAddress.name}</p>
            <p>{order.shippingAddress.line1}</p>
            {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
            <p>{order.shippingAddress.postcode} {order.shippingAddress.city}</p>
            {order.shippingAddress.country !== "DK" && <p>{order.shippingAddress.country}</p>}
          </address>
        )}
      </section>

      {/* Tracking */}
      {order.trackingNumber && (
        <section className="border border-blue-200 bg-blue-50 rounded-xl p-5">
          <p className="text-sm font-semibold text-blue-800 mb-1">Din pakke er på vej</p>
          <p className="text-sm text-blue-700">
            Trackingnummer: <span className="font-mono font-semibold">{order.trackingNumber}</span>
          </p>
        </section>
      )}

      {/* Contact */}
      <aside className="text-sm text-gray-500 border-t border-gray-100 pt-6">
        Spørgsmål til din ordre?{" "}
        <a href={`mailto:${contactEmail}`} className="text-secondary hover:underline">
          Skriv til os på {contactEmail}
        </a>
      </aside>
    </div>
  );
}
