"use client";

import { useState } from "react";
import { formatPrice } from "@/lib/utils";

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

type PakketilbudMeta = {
  isPakketilbud: true;
  pakketilbudName: string;
  items: {
    label?: string;
    productName?: string;
    size?: string;
    colorName?: string;
    customName?: string;
    customNumber?: string;
  }[];
};

type PrintElementMeta = {
  printElements: { zoneLabel: string; side: string; type: string; value?: string; fontSize?: string }[];
};

type OptionSelectionMeta = { groupLabel: string; value: string }[];

type OrderItem = {
  id: string;
  quantity: number;
  priceAtPurchase: number;
  customName: string | null;
  customNumber: string | null;
  colorName: string | null;
  optionSelections: unknown;
  sku: { size: string; product: { name: string } } | null;
};

type Order = {
  id: string;
  createdAt: Date;
  status: string;
  total: number;
  shippingFee: number;
  discountApplied: number;
  deliveryMethod: string;
  customerName: string | null;
  trackingNumber: string | null;
  items: OrderItem[];
};

function ItemRow({ item, vatPct }: { item: OrderItem; vatPct: number }) {
  const opts = item.optionSelections;
  const priceInclVat = Math.round(item.priceAtPurchase * (1 + vatPct / 100));

  // Pakketilbud
  if (opts && typeof opts === "object" && !Array.isArray(opts) && (opts as PakketilbudMeta).isPakketilbud) {
    const meta = opts as PakketilbudMeta;
    return (
      <li className="py-3 border-b border-gray-50 last:border-0">
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">
              {item.quantity}× {meta.pakketilbudName}
              <span className="ml-2 text-xs bg-secondary/10 text-secondary px-2 py-0.5 rounded-full font-normal">
                Pakketilbud
              </span>
            </p>
            <ul className="mt-1 space-y-0.5">
              {meta.items.map((comp, i) => (
                <li key={i} className="text-xs text-gray-500 flex items-center gap-1">
                  <span className="w-1 h-1 bg-gray-300 rounded-full shrink-0" />
                  {comp.label ?? comp.productName ?? "–"}
                  {comp.size && <span className="text-gray-400">({comp.size})</span>}
                  {comp.colorName && <span className="text-gray-400">· {comp.colorName}</span>}
                  {comp.customName && <span className="text-gray-400">· {comp.customName}</span>}
                  {comp.customNumber && <span className="text-gray-400">#{comp.customNumber}</span>}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-sm font-medium text-gray-700 shrink-0">{formatPrice(priceInclVat * item.quantity)}</p>
        </div>
      </li>
    );
  }

  // Regular item
  const printMeta = opts && typeof opts === "object" && !Array.isArray(opts) && (opts as PrintElementMeta).printElements
    ? (opts as PrintElementMeta).printElements
    : null;
  const selectionMeta = Array.isArray(opts) ? (opts as OptionSelectionMeta) : null;

  return (
    <li className="py-3 border-b border-gray-50 last:border-0">
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
                Tryk:{" "}
                {printMeta
                  .map((p) => `${p.zoneLabel} (${p.type === "text" ? p.value : "logo"})`)
                  .join(", ")}
              </span>
            )}
          </div>
        </div>
        <p className="text-sm font-medium text-gray-700 shrink-0">{formatPrice(priceInclVat * item.quantity)}</p>
      </div>
    </li>
  );
}

function OrderCard({ order, vatPct }: { order: Order; vatPct: number }) {
  const [open, setOpen] = useState(false);

  const date = new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(order.createdAt));

  const isPickup = order.deliveryMethod === "PICKUP";

  return (
    <li className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Header — always visible */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-5 py-4 flex items-center justify-between gap-3 hover:bg-gray-50 transition"
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className="min-w-0">
            <p className="text-xs text-gray-400">{date}</p>
            <p className="font-semibold text-sm mt-0.5">{formatPrice(order.total)}</p>
          </div>
          <span
            className={`hidden sm:inline-block text-xs font-semibold px-3 py-1 rounded-full shrink-0 ${
              STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-600"
            }`}
          >
            {STATUS_LABELS[order.status] ?? order.status}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span
            className={`sm:hidden text-xs font-semibold px-2 py-0.5 rounded-full ${
              STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-600"
            }`}
          >
            {STATUS_LABELS[order.status] ?? order.status}
          </span>
          <span className="text-gray-400 text-sm">{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-gray-100 px-5 py-4 space-y-4">
          {/* Items */}
          <ul className="divide-y divide-gray-50">
            {order.items.map((item) => (
              <ItemRow key={item.id} item={item} vatPct={vatPct} />
            ))}
          </ul>

          {/* Totals */}
          <div className="border-t border-gray-100 pt-3 space-y-1 text-sm">
            {order.discountApplied > 0 && (
              <div className="flex justify-between text-green-700">
                <span>Rabat</span>
                <span>−{formatPrice(order.discountApplied)}</span>
              </div>
            )}
            {order.shippingFee > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>Fragt</span>
                <span>{formatPrice(order.shippingFee)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span>{formatPrice(order.total)}</span>
            </div>
          </div>

          {/* Meta */}
          <div className="text-xs text-gray-400 space-y-1 pt-1">
            <p>Ordre-ID: <span className="font-mono">{order.id.slice(0, 8)}…</span></p>
            <p>Levering: {isPickup ? "Afhentning" : "Forsendelse (Danmark)"}</p>
            {order.trackingNumber && (
              <p>Trackingnummer: <span className="font-mono">{order.trackingNumber}</span></p>
            )}
          </div>

          <div className="pt-1">
            <a href={`/mine-ordrer/${order.id}`} className="text-sm text-secondary hover:underline font-medium">
              Se fuld ordre →
            </a>
          </div>
        </div>
      )}
    </li>
  );
}

export function OrderList({ orders, vatPct }: { orders: Order[]; vatPct: number }) {
  return (
    <ul className="space-y-3">
      {orders.map((order) => (
        <OrderCard key={order.id} order={order} vatPct={vatPct} />
      ))}
    </ul>
  );
}
