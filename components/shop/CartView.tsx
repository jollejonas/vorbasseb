"use client";

import { useState, useEffect } from "react";
import { Trash2, Package, Truck, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "./CartProvider";
import { formatPrice, calcShipping } from "@/lib/utils";

type DeliveryMethod = "SHIPPING" | "PICKUP";

export function CartView() {
  const { items, removeItem, updateQty, subtotal, clearCart } = useCart();
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("SHIPPING");
  const [membership, setMembership] = useState<{ isMember: boolean; discountPct: number } | null>(null);

  useEffect(() => {
    fetch("/api/membership")
      .then((r) => r.json())
      .then(setMembership)
      .catch(() => {});
  }, []);

  if (items.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 mb-6">Din kurv er tom.</p>
        <Link
          href="/butik"
          className="inline-block bg-secondary text-white px-6 py-3 rounded-xl font-semibold hover:bg-secondary-dark transition"
        >
          Gå til butikken
        </Link>
      </div>
    );
  }

  const shipping = deliveryMethod === "PICKUP" ? 0 : calcShipping(subtotal);
  const total = subtotal + shipping;

  return (
    <div className="space-y-6">
      {/* Item list */}
      <ul className="divide-y divide-gray-100">
        {items.map((item) => (
          <li
            key={`${item.skuId}::${item.customName}::${item.customNumber}`}
            className="flex gap-4 py-4"
          >
            <div className="relative w-20 h-20 shrink-0 bg-surface rounded-lg overflow-hidden">
              {item.image ? (
                <Image
                  src={item.image}
                  alt={item.productName}
                  fill
                  className="object-cover"
                  sizes="80px"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs font-bold">
                  VBK
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{item.productName}</p>
              <p className="text-sm text-gray-500">
                Størrelse: {item.size}
                {item.customName && ` · Tryk: ${item.customName}`}
                {item.customNumber && ` #${item.customNumber}`}
              </p>
              <p className="text-sm font-bold text-secondary mt-1">
                {formatPrice(
                  (item.price + (item.customizationFee ?? 0)) * item.quantity,
                )}
              </p>
            </div>

            <div className="flex flex-col items-end gap-2">
              <button
                onClick={() =>
                  removeItem(item.skuId, item.customName, item.customNumber)
                }
                className="text-gray-400 hover:text-red-500 transition"
                aria-label="Fjern"
              >
                <Trash2 size={18} />
              </button>
              <div className="flex items-center border rounded-lg overflow-hidden">
                <button
                  onClick={() =>
                    item.quantity > 1
                      ? updateQty(item.skuId, item.quantity - 1)
                      : removeItem(
                          item.skuId,
                          item.customName,
                          item.customNumber,
                        )
                  }
                  className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 text-lg"
                >
                  −
                </button>
                <span className="w-8 text-center text-sm font-medium">
                  {item.quantity}
                </span>
                <button
                  onClick={() => updateQty(item.skuId, item.quantity + 1)}
                  className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 text-lg"
                >
                  +
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Delivery method */}
      <div className="bg-surface rounded-xl p-5">
        <p className="text-sm font-semibold text-gray-700 mb-3">Leveringsmetode</p>
        <div className="space-y-2">
          <label className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition ${deliveryMethod === "SHIPPING" ? "border-secondary bg-white" : "border-gray-200 bg-white hover:border-gray-300"}`}>
            <input
              type="radio"
              name="delivery"
              value="SHIPPING"
              checked={deliveryMethod === "SHIPPING"}
              onChange={() => setDeliveryMethod("SHIPPING")}
              className="accent-secondary"
            />
            <Truck size={18} className="text-secondary shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">Levering til din adresse</p>
              <p className="text-xs text-gray-500">
                {calcShipping(subtotal) === 0
                  ? "Gratis fragt (over 499 kr)"
                  : `${formatPrice(calcShipping(subtotal))} — gratis ved køb over 499 kr`}
              </p>
            </div>
            {calcShipping(subtotal) === 0 && (
              <span className="text-xs text-green-600 font-semibold">Gratis</span>
            )}
          </label>

          <label className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition ${deliveryMethod === "PICKUP" ? "border-secondary bg-white" : "border-gray-200 bg-white hover:border-gray-300"}`}>
            <input
              type="radio"
              name="delivery"
              value="PICKUP"
              checked={deliveryMethod === "PICKUP"}
              onChange={() => setDeliveryMethod("PICKUP")}
              className="accent-secondary"
            />
            <Package size={18} className="text-secondary shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">Afhentning ved klubben</p>
              <p className="text-xs text-gray-500">Vorbasse Stadion — vi giver besked når din ordre er klar</p>
            </div>
            <span className="text-xs text-green-600 font-semibold">Gratis</span>
          </label>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-surface rounded-xl p-5 space-y-3">
        <div className="flex justify-between text-sm">
          <span>Subtotal</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Fragt</span>
          <span className={shipping === 0 ? "text-green-600 font-medium" : ""}>
            {shipping === 0 ? "Gratis" : formatPrice(shipping)}
          </span>
        </div>
        <div className="flex justify-between font-bold text-lg border-t pt-3">
          <span>Total</span>
          <span>{formatPrice(total)}</span>
        </div>
      </div>

      {/* Member discount notice */}
      {membership?.isMember && (
        <div className="flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-xl px-4 py-3 text-sm text-primary font-medium">
          <Star size={16} className="shrink-0" />
          Du sparer {membership.discountPct}% som fanklubsmedlem — rabatten trækkes automatisk i kassen
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={clearCart}
          className="text-sm text-gray-500 hover:text-red-500 underline transition"
        >
          Ryd kurv
        </button>
        <CheckoutButton deliveryMethod={deliveryMethod} />
      </div>
    </div>
  );
}

function CheckoutButton({ deliveryMethod }: { deliveryMethod: DeliveryMethod }) {
  const { items } = useCart();

  async function handleCheckout() {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, deliveryMethod }),
    });

    if (!res.ok) {
      alert("Noget gik galt. Prøv igen.");
      return;
    }

    const { url } = await res.json();
    window.location.href = url;
  }

  return (
    <button
      onClick={handleCheckout}
      className="flex-1 bg-primary hover:bg-primary-dark text-secondary font-bold py-3 px-6 rounded-xl transition"
    >
      Gå til kasse →
    </button>
  );
}
