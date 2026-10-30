"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { PromoCodeForm } from "./PromoCodeForm";

type StripePromoCode = {
  id: string;
  code: string;
  times_redeemed: number;
  max_redemptions: number | null;
  expires_at: number | null;
  metadata?: { shopProductName?: string };
  promotion: {
    coupon: {
      percent_off: number | null;
      amount_off: number | null;
      currency: string | null;
      applies_to?: { products: string[] };
    } | string | null;
  } | null;
};

export function PromoCodeList({ products }: { products: { id: string; name: string }[] }) {
  const [codes, setCodes] = useState<StripePromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const fetchCodes = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch("/api/admin/promo-codes");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Kunne ikke hente rabatkoder");
      setCodes(data);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Kunne ikke hente rabatkoder");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCodes();
  }, [fetchCodes]);

  async function handleDeactivate(id: string) {
    if (!confirm("Deaktivér denne kode?")) return;
    try {
      const res = await fetch(`/api/admin/promo-codes/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast.success("Kode deaktiveret");
      fetchCodes();
    } catch {
      toast.error("Noget gik galt");
    }
  }

  function formatDiscount(promotion: StripePromoCode["promotion"]) {
    const coupon = promotion?.coupon;
    if (!coupon || typeof coupon === "string") return "–";
    if (coupon.percent_off) return `${coupon.percent_off}%`;
    if (coupon.amount_off)
      return `${(coupon.amount_off / 100).toFixed(2).replace(".", ",")} kr`;
    return "–";
  }

  return (
    <div className="space-y-8">
      <PromoCodeForm onCreated={fetchCodes} products={products} />

      <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
        <h2 className="font-semibold text-gray-800 mb-4">Aktive koder</h2>
        {loading ? (
          <p className="text-sm text-gray-400">Henter…</p>
        ) : loadError ? <p role="alert" className="text-sm text-red-700">{loadError}</p> : codes.length === 0 ? (
          <p className="text-sm text-gray-400">Ingen aktive rabatkoder</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2 pr-4 font-medium">Kode</th>
                <th className="pb-2 pr-4 font-medium">Rabat</th>
                <th className="pb-2 pr-4 font-medium">Gælder for</th>
                <th className="pb-2 pr-4 font-medium">Anvendt</th>
                <th className="pb-2 pr-4 font-medium">Udløber</th>
                <th className="pb-2 font-medium">Handling</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {codes.map((c) => (
                <tr key={c.id}>
                  <td className="py-2.5 pr-4 font-mono font-medium">{c.code}</td>
                  <td className="py-2.5 pr-4">{formatDiscount(c.promotion)}</td>
                  <td className="py-2.5 pr-4">{c.metadata?.shopProductName || (typeof c.promotion?.coupon === "object" && c.promotion?.coupon?.applies_to?.products.length ? "Udvalgte produkter i Stripe" : "Alle produkter")}</td>
                  <td className="py-2.5 pr-4 text-gray-500">
                    {c.times_redeemed}
                    {c.max_redemptions ? ` / ${c.max_redemptions}` : ""}
                  </td>
                  <td className="py-2.5 pr-4 text-gray-500">
                    {c.expires_at
                      ? new Intl.DateTimeFormat("da-DK").format(
                          new Date(c.expires_at * 1000),
                        )
                      : "–"}
                  </td>
                  <td className="py-2.5">
                    <button
                      onClick={() => handleDeactivate(c.id)}
                      className="text-red-600 hover:underline text-xs font-medium"
                    >
                      Deaktivér
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
