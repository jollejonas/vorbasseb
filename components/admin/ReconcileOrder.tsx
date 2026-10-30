"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReconcileOrder() {
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  return <details className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
    <summary className="cursor-pointer font-semibold">Betalt i Stripe, men ordren mangler?</summary>
    <p className="my-3 text-sm">Kontrollér betalingen og færdigbehandl den eksisterende bestilling. Kunden bliver ikke opkrævet igen. En nybekræftet ordre udløser den normale ordrebekræftelse.</p>
    <form className="flex flex-wrap gap-2" onSubmit={async e => {
      e.preventDefault(); if (busy) return; setBusy(true); setError("");
      try {
        const response = await fetch("/api/admin/reconcile-order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reference: reference.trim() }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        router.push(`/admin/ordrer/${result.orderId}`); router.refresh();
      } catch (error) { setError(error instanceof Error ? error.message : "Kontrollen mislykkedes. Prøv igen."); }
      finally { setBusy(false); }
    }}>
      <input aria-label="Stripe betalings- eller checkout-id" value={reference} onChange={e => setReference(e.target.value)} required placeholder="pi_… eller cs_…" className="min-w-64 flex-1 rounded border bg-white p-2" />
      <button disabled={busy} className="rounded bg-secondary px-4 py-2 text-white disabled:opacity-50">{busy ? "Kontrollerer…" : "Kontrollér og færdigbehandl"}</button>
    </form>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
  </details>;
}
