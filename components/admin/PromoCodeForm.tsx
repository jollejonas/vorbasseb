"use client";

import { useState } from "react";
import { toast } from "sonner";

type Props = {
  onCreated: () => void;
};

export function PromoCodeForm({ onCreated }: Props) {
  const [code, setCode] = useState("");
  const [type, setType] = useState<"percent" | "fixed">("percent");
  const [amount, setAmount] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [oneTimePerCustomer, setOneTimePerCustomer] = useState(false);
  const [maxUses, setMaxUses] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || !amount) return;

    setSaving(true);
    try {
      const res = await fetch("/api/admin/promo-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          type,
          amount: Number(amount),
          expiryDate: expiryDate || undefined,
          oneTimePerCustomer,
          maxUses: maxUses ? Number(maxUses) : undefined,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      toast.success(`Kode oprettet: ${data.code}`);
      setCode("");
      setAmount("");
      setExpiryDate("");
      setOneTimePerCustomer(false);
      setMaxUses("");
      onCreated();
    } catch {
      toast.error("Noget gik galt – tjek Stripe-nøglen");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm"
    >
      <h2 className="font-semibold text-gray-800 mb-4">Opret rabatkode</h2>
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Code */}
        <div className="sm:col-span-2">
          <label className="block text-xs text-gray-500 mb-1">Kode</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="SOMMER25"
            required
            className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-secondary"
          />
        </div>

        {/* Type */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Type</label>
          <div className="flex gap-3">
            {[
              { value: "percent", label: "Procent (%)" },
              { value: "fixed", label: "Fast beløb (kr)" },
            ].map((t) => (
              <label
                key={t.value}
                className="flex items-center gap-1.5 text-sm cursor-pointer"
              >
                <input
                  type="radio"
                  name="type"
                  value={t.value}
                  checked={type === t.value}
                  onChange={() => setType(t.value as "percent" | "fixed")}
                  className="accent-secondary"
                />
                {t.label}
              </label>
            ))}
          </div>
        </div>

        {/* Amount */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">
            {type === "percent" ? "Rabat (%)" : "Rabat (kr)"}
          </label>
          <input
            type="number"
            min={1}
            max={type === "percent" ? 100 : undefined}
            step={type === "percent" ? 1 : 0.01}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={type === "percent" ? "10" : "50"}
            required
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
          />
        </div>

        {/* Expiry */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">
            Udløbsdato (valgfri)
          </label>
          <input
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
          />
        </div>

        {/* Max uses */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">
            Maks. anvendelser (valgfri)
          </label>
          <input
            type="number"
            min={1}
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            placeholder="Ubegrænset"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
          />
        </div>

        {/* One-time per customer */}
        <div className="sm:col-span-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={oneTimePerCustomer}
              onChange={(e) => setOneTimePerCustomer(e.target.checked)}
              className="accent-secondary"
            />
            Kun én gang per kunde (gælder kun nye kunder i Stripe)
          </label>
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="mt-4 bg-secondary text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-secondary-dark transition disabled:opacity-50"
      >
        {saving ? "Opretter…" : "Opret kode"}
      </button>
    </form>
  );
}
