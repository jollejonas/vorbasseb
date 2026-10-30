"use client";

import { useState } from "react";
import { toast } from "sonner";

type Props = {
  onCreated: () => void;
  products: { id: string; name: string }[];
};

export function PromoCodeForm({ onCreated, products }: Props) {
  const [productId, setProductId] = useState("");
  const [replacesSale, setReplacesSale] = useState(false);
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
    if (!/^[A-Z0-9]+$/.test(code.trim().toUpperCase())) {
      toast.error("Brug kun A–Z og 0–9. Skriv fx TRAENER i stedet for TRÆNER.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/promo-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          type,
          productId: productId || undefined,
          amount: Number(amount),
          expiryDate: expiryDate || undefined,
          oneTimePerCustomer,
          replacesSale,
          maxUses: maxUses ? Number(maxUses) : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Rabatkoden kunne ikke oprettes. Prøv igen.");
      toast.success(`Kode oprettet: ${data.code}`);
      setCode("");
      setAmount("");
      setExpiryDate("");
      setOneTimePerCustomer(false);
      setMaxUses("");
      setProductId("");
      setReplacesSale(false);
      onCreated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Der kunne ikke oprettes forbindelse. Prøv igen.");
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
            maxLength={100}
            className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-secondary"
          />
          <p className="mt-1 text-xs text-gray-500">Brug A–Z og 0–9, fx TRAENERJULESWEATER2026. Ingen Æ, Ø eller Å.</p>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="promo-product" className="block text-xs text-gray-500 mb-1">Gælder for</label>
          <select id="promo-product" value={productId} onChange={(e) => setProductId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">Alle nuværende produkter og pakketilbud</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <p className="mt-1 text-xs text-gray-500">Vælg ét produkt for kun at give rabat på dette produkt i kurven. Gælder alle størrelser og farver, men ikke som del af et pakketilbud.</p>
          {type === "fixed" && <p className="mt-1 text-xs text-gray-500">Et fast beløb gives én gang pr. ordre, højst værdien af de varer, koden gælder for. Ikke pr. stk.</p>}
          <p className="mt-1 text-xs text-gray-500">Koden indtastes i kurven. Den erstatter fanklubsrabat og kan ikke kombineres med tildelte produkter. Nye produkter tilføjes ikke automatisk til eksisterende koder.</p>
        </div>

        <div className="sm:col-span-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={replacesSale} onChange={e => setReplacesSale(e.target.checked)} className="accent-secondary" />
            Erstat eksisterende tilbud
          </label>
          <p className="mt-1 text-xs text-gray-500">Når feltet er valgt, beregnes kodens rabat fra normalprisen på de valgte varer. Ellers beholder tilbudsvarer deres tilbudspris og får ingen rabat fra koden.</p>
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
            Kun nye kunder i Stripe (første køb)
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
