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
  coupon: {
    percent_off: number | null;
    amount_off: number | null;
    currency: string | null;
  };
};

export function PromoCodeList() {
  const [codes, setCodes] = useState<StripePromoCode[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCodes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/promo-codes");
      if (!res.ok) throw new Error();
      setCodes(await res.json());
    } catch {
      toast.error("Kunne ikke hente rabatkoder");
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

  function formatDiscount(coupon: StripePromoCode["coupon"]) {
    if (coupon.percent_off) return `${coupon.percent_off}%`;
    if (coupon.amount_off)
      return `${(coupon.amount_off / 100).toFixed(2).replace(".", ",")} kr`;
    return "–";
  }

  return (
    <div className="space-y-8">
      <PromoCodeForm onCreated={fetchCodes} />

      <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
        <h2 className="font-semibold text-gray-800 mb-4">Aktive koder</h2>
        {loading ? (
          <p className="text-sm text-gray-400">Henter…</p>
        ) : codes.length === 0 ? (
          <p className="text-sm text-gray-400">Ingen aktive rabatkoder</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2 pr-4 font-medium">Kode</th>
                <th className="pb-2 pr-4 font-medium">Rabat</th>
                <th className="pb-2 pr-4 font-medium">Anvendt</th>
                <th className="pb-2 pr-4 font-medium">Udløber</th>
                <th className="pb-2 font-medium">Handling</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {codes.map((c) => (
                <tr key={c.id}>
                  <td className="py-2.5 pr-4 font-mono font-medium">{c.code}</td>
                  <td className="py-2.5 pr-4">{formatDiscount(c.coupon)}</td>
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
