"use client";

import { useState, useEffect } from "react";
import { Trash2, Package, Truck, Star, AlertTriangle } from "lucide-react";
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

  // Detect trainer vs normal items
  const hasTrainerItems = items.some((i) => i.clubRoleRequired === "TRAINER");
  const hasNormalItems = items.some((i) => i.clubRoleRequired !== "TRAINER");
  const isMixedCart = hasTrainerItems && hasNormalItems;
  const isTrainerOnly = hasTrainerItems && !hasNormalItems;

  // Trainer-only carts are always pickup (free)
  const effectiveDelivery: DeliveryMethod = isTrainerOnly ? "PICKUP" : deliveryMethod;
  const shipping = effectiveDelivery === "PICKUP" ? 0 : calcShipping(subtotal);
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

      {/* Mixed cart warning */}
      {isMixedCart && (
        <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
          <AlertTriangle size={18} className="text-orange-500 shrink-0 mt-0.5" />
          <div className="text-sm text-orange-800">
            <p className="font-semibold mb-0.5">Trænerprodukter kan ikke blandes med normale produkter</p>
            <p className="text-orange-700">Fjern enten trænerprodukterne eller de normale produkter for at fortsætte til kassen.</p>
          </div>
        </div>
      )}

      {/* Delivery method — hidden for trainer-only carts */}
      {!isTrainerOnly && (
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
      )}

      {/* Trainer-only: pickup notice */}
      {isTrainerOnly && (
        <div className="flex items-center gap-3 bg-surface rounded-xl p-4">
          <Package size={18} className="text-secondary shrink-0" />
          <div>
            <p className="text-sm font-semibold">Afhentning ved klubben</p>
            <p className="text-xs text-gray-500">Trænerprodukter afhentes altid ved Vorbasse Stadion</p>
          </div>
          <span className="ml-auto text-xs text-green-600 font-semibold">Gratis</span>
        </div>
      )}

      {/* Summary */}
      <div className="bg-surface rounded-xl p-5 space-y-3">
        <div className="flex justify-between text-sm">
          <span>Subtotal</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
        {membership?.isMember && !isTrainerOnly && (
          <div className="flex justify-between text-sm text-green-600 font-medium">
            <span>Fanklubsrabat ({membership.discountPct}%)</span>
            <span>−{formatPrice(Math.round(subtotal * membership.discountPct / 100))}</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span>Fragt</span>
          <span className={shipping === 0 ? "text-green-600 font-medium" : ""}>
            {shipping === 0 ? "Gratis" : formatPrice(shipping)}
          </span>
        </div>
        <div className="flex justify-between font-bold text-lg border-t pt-3">
          <span>Total</span>
          <span>
            {isTrainerOnly
              ? "0,00 kr"
              : membership?.isMember
                ? formatPrice(total - Math.round(subtotal * membership.discountPct / 100))
                : formatPrice(total)}
          </span>
        </div>
        {membership?.isMember && !isTrainerOnly && (
          <p className="text-xs text-gray-400">* Den endelige rabat beregnes af Stripe ved betaling</p>
        )}
      </div>

      {/* Member discount notice / CTA — not shown for trainer-only carts */}
      {!isTrainerOnly && (
        membership?.isMember ? (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 font-medium">
            <Star size={16} className="shrink-0 text-green-500" />
            Du er fanklubsmedlem — {membership.discountPct}% rabat er inkluderet i totalen ovenfor
          </div>
        ) : membership !== null ? (
          <div className="bg-[#0a0f1e] rounded-xl px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex-1">
              <p className="text-white text-sm font-semibold flex items-center gap-1.5">
                <Star size={14} className="text-primary shrink-0" />
                Bliv fanklubsmedlem og spar {membership?.discountPct ?? 10}% på alle køb
              </p>
              <p className="text-white/60 text-xs mt-0.5">Fra kun 49 kr/md — støt klubben og få rabat i butikken</p>
            </div>
            <a
              href="/fanklub"
              className="shrink-0 bg-primary text-secondary text-xs font-bold px-4 py-2 rounded-lg hover:bg-primary-dark transition whitespace-nowrap"
            >
              Bliv medlem →
            </a>
          </div>
        ) : null
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={clearCart}
          className="text-sm text-gray-500 hover:text-red-500 underline transition"
        >
          Ryd kurv
        </button>
        <CheckoutButton
          deliveryMethod={effectiveDelivery}
          isTrainerOnly={isTrainerOnly}
          disabled={isMixedCart}
        />
      </div>
    </div>
  );
}

function CheckoutButton({
  deliveryMethod,
  isTrainerOnly,
  disabled,
}: {
  deliveryMethod: DeliveryMethod;
  isTrainerOnly: boolean;
  disabled: boolean;
}) {
  const { items, clearCart } = useCart();
  const [loading, setLoading] = useState(false);

  async function handleCheckout() {
    setLoading(true);

    if (isTrainerOnly) {
      const res = await fetch("/api/checkout/traener", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });

      setLoading(false);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Noget gik galt. Prøv igen.");
        return;
      }

      clearCart();
      window.location.href = "/ordre-bekraeftelse";
      return;
    }

    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, deliveryMethod }),
    });

    setLoading(false);

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
      disabled={disabled || loading}
      className="flex-1 bg-primary hover:bg-primary-dark text-secondary font-bold py-3 px-6 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? "Behandler…" : isTrainerOnly ? "Bestil gratis →" : "Gå til kasse →"}
    </button>
  );
}
