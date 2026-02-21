"use client";

import { Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "./CartProvider";
import { formatPrice, calcShipping } from "@/lib/utils";

export function CartView() {
  const { items, removeItem, updateQty, subtotal, clearCart } = useCart();

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

  const shipping = calcShipping(subtotal);
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
        {shipping > 0 && (
          <p className="text-xs text-gray-500">
            Gratis fragt ved køb over {formatPrice(49900)}
          </p>
        )}
        <div className="flex justify-between font-bold text-lg border-t pt-3">
          <span>Total</span>
          <span>{formatPrice(total)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={clearCart}
          className="text-sm text-gray-500 hover:text-red-500 underline transition"
        >
          Ryd kurv
        </button>
        <CheckoutButton />
      </div>
    </div>
  );
}

function CheckoutButton() {
  const { items } = useCart();

  async function handleCheckout() {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
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
