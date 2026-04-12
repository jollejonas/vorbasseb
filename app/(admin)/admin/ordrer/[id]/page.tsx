import { Fragment } from "react";
import { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";
import { AdminOrderActions } from "@/components/admin/AdminOrderActions";
import { PrintPreviewModal } from "@/components/admin/PrintPreviewModal";
import { PrintButton } from "@/components/admin/PrintButton";

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
        include: {
            sku: {
              include: {
                product: {
                  include: {
                    designerZones: { include: { fixedLogo: true }, orderBy: { positionOrd: "asc" } },
                  },
                },
              },
            },
          },
      },
      shippingAddress: true,
      user: { select: { name: true, email: true, customerNumber: true } },
    },
  });

  if (!order) notFound();

  // Collect skuIds from pakketilbud sub-items to look up item numbers
  const pakkeSkuIds = order.items.flatMap((item) => {
    const meta = item.optionSelections as { isPakketilbud?: boolean; items?: { skuId?: string }[] } | null;
    if (meta && !Array.isArray(meta) && meta.isPakketilbud) {
      return (meta.items ?? []).map((c) => c.skuId).filter(Boolean) as string[];
    }
    return [];
  });
  const pakkeSkus = pakkeSkuIds.length > 0
    ? await prisma.sKU.findMany({
        where: { id: { in: pakkeSkuIds } },
        select: {
          id: true,
          itemNumber: true,
          product: {
            select: {
              images: true,
              designerFrontImageIdx: true,
              designerBackImageIdx: true,
              designerPrintColor: true,
              designerZones: { include: { fixedLogo: true }, orderBy: { positionOrd: "asc" } },
            },
          },
        },
      })
    : [];
  const pakkeSkuMap = new Map(pakkeSkus.map((s) => [s.id, s]));

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/admin/ordrer" className="text-sm text-gray-500 hover:text-secondary print:hidden">
          ← Ordrer
        </Link>
        <h1 className="text-2xl font-bold">Ordre #{order.orderNumber}</h1>
        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
          {STATUS_LABELS[order.status] ?? order.status}
        </span>
        <PrintButton />
      </div>

      {/* Group order hold banner */}
      {order.groupOrderHoldUntil && (
        <div className={`flex items-start gap-3 rounded-xl px-4 py-3 mb-6 ${new Date(order.groupOrderHoldUntil) > new Date() ? "bg-blue-50 border border-blue-200" : "bg-green-50 border border-green-200"}`}>
          <span className="text-lg mt-0.5">{new Date(order.groupOrderHoldUntil) > new Date() ? "⏳" : "✅"}</span>
          <div>
            <p className={`text-sm font-semibold ${new Date(order.groupOrderHoldUntil) > new Date() ? "text-blue-900" : "text-green-900"}`}>
              {new Date(order.groupOrderHoldUntil) > new Date() ? "Samlebestilling — må ikke behandles endnu" : "Samlebestilling — klar til behandling"}
            </p>
            <p className={`text-sm mt-0.5 ${new Date(order.groupOrderHoldUntil) > new Date() ? "text-blue-700" : "text-green-700"}`}>
              Deadline:{" "}
              {new Intl.DateTimeFormat("da-DK", { dateStyle: "full", timeStyle: "short", timeZone: "Europe/Copenhagen" }).format(new Date(order.groupOrderHoldUntil))}
            </p>
          </div>
        </div>
      )}

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
            {order.items.map((item) => {
              type PrintEl = { zoneLabel: string; side: string; type: string; value: string; fontSize: string };
              type PakketilbudItemMeta = { itemId: string; productId: string; productName: string; label?: string; skuId: string; size: string; colorName?: string; customName?: string; customNumber?: string; printElements?: PrintEl[] };
              type PakketilbudOrderMeta = { isPakketilbud: true; pakketilbudName: string; items: PakketilbudItemMeta[] };
              const rawOpt = item.optionSelections as PakketilbudOrderMeta | { printElements: { side: string; zoneLabel: string; type: string; value: string; fontSize: string }[] } | { groupLabel: string; value: string }[] | null;
              const pakkeMeta = rawOpt && !Array.isArray(rawOpt) && (rawOpt as PakketilbudOrderMeta).isPakketilbud === true ? (rawOpt as PakketilbudOrderMeta) : null;
              // ── Pakketilbud rows ─────────────────────────────────────────────
              if (pakkeMeta) {
                return (
                  <Fragment key={item.id}>
                    {/* Group header row — name + qty + price */}
                    <tr className="bg-gray-50">
                      <td colSpan={5} className="px-5 py-2.5 font-medium text-sm">
                        {pakkeMeta.pakketilbudName}
                        <span className="ml-2 text-xs font-normal text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">
                          Pakketilbud
                        </span>
                      </td>
                      <td className="px-5 py-2.5 text-right text-sm">{item.quantity}</td>
                      <td className="px-5 py-2.5 text-right text-sm font-medium">
                        {formatPrice(item.priceAtPurchase * item.quantity)}
                      </td>
                    </tr>
                    {/* One row per sub-item */}
                    {pakkeMeta.items.map((c, ci) => {
                      const printText = [
                        ...(c.customName ? [c.customName] : []),
                        ...(c.customNumber ? [`#${c.customNumber}`] : []),
                        ...(c.printElements?.map((p) =>
                          p.type === "text" ? `${p.zoneLabel}: ${p.value}` : `${p.zoneLabel}: Logo`
                        ) ?? []),
                      ].join(" · ");
                      return (
                        <tr key={ci} className="text-sm">
                          <td className="px-5 py-1.5 pl-8 text-gray-700">↳ {c.label || c.productName}</td>
                          <td className="px-5 py-1.5 font-mono text-xs text-gray-500">
                            {pakkeSkuMap.get(c.skuId)?.itemNumber ?? "–"}
                          </td>
                          <td className="px-5 py-1.5 text-gray-500">{c.size || "–"}</td>
                          <td className="px-5 py-1.5 text-gray-500">{c.colorName || "–"}</td>
                          <td className="px-5 py-1.5 text-gray-500">
                            {(() => {
                              const skuData = pakkeSkuMap.get(c.skuId);
                              if (printText && c.printElements?.length && skuData?.product?.designerZones?.length) {
                                return (
                                  <PrintPreviewModal
                                    label={c.label ?? c.productName}
                                    printSummary={printText}
                                    product={skuData.product}
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    printElements={c.printElements as any}
                                  />
                                );
                              }
                              return printText || "–";
                            })()}
                          </td>
                          <td /><td />
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              }

              // ── Regular item row ─────────────────────────────────────────────
              const raw = rawOpt;
              const printParts: string[] = [];
              if (item.customName || item.customNumber) {
                printParts.push([item.customName, item.customNumber ? `#${item.customNumber}` : null].filter(Boolean).join(" "));
              }
              if (raw && !Array.isArray(raw) && (raw as { printElements?: unknown[] }).printElements) {
                ((raw as { printElements: PrintEl[] }).printElements).forEach((p) => {
                  printParts.push(p.type === "text" ? `${p.zoneLabel}: ${p.value}` : `${p.zoneLabel}: Logo`);
                });
              }
              const selections = Array.isArray(raw) ? raw : [];
              if (selections.length) {
                printParts.push(...selections.map((s) => `${s.groupLabel}: ${s.value}`));
              }

              return (
              <tr key={item.id}>
                <td className="px-5 py-3">{item.sku?.product.name ?? "–"}</td>
                <td className="px-5 py-3 font-mono text-xs text-gray-500">{item.sku?.itemNumber ?? "–"}</td>
                <td className="px-5 py-3">{item.sku?.size ?? "–"}</td>
                <td className="px-5 py-3 text-gray-500">{item.colorName ?? "–"}</td>
                <td className="px-5 py-3 text-gray-500">
                  {(() => {
                    if (!printParts.length) return "–";
                    const printEls = raw && !Array.isArray(raw) && (raw as { printElements?: unknown[] }).printElements
                      ? (raw as { printElements: import("@/components/shop/CartProvider").PrintElement[] }).printElements
                      : null;
                    const product = item.sku?.product;
                    if (printEls?.length && product?.designerZones?.length) {
                      return (
                        <PrintPreviewModal
                          label={product.name}
                          printSummary={printParts.join(" · ")}
                          product={product}
                          printElements={printEls}
                        />
                      );
                    }
                    return printParts.join(" · ");
                  })()}
                </td>
                <td className="px-5 py-3 text-right">{item.quantity}</td>
                <td className="px-5 py-3 text-right font-medium">{formatPrice(item.priceAtPurchase * item.quantity)}</td>
              </tr>
              );
            })}
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
      <section className="border rounded-xl p-5 print:hidden">
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
