"use client";
import { useState } from "react";
import Link from "next/link";

type Entry = {
  sessionId: string; created: number; name: string; email: string | null;
  total: number | null; currency: string | null; discount: number; paymentStatus: string;
  orderId: string | null; orderNumber: number | null;
  status: "CONFIRMED" | "NEEDS_PROCESSING" | "MISSING"; orderStatus: string | null;
  items: { name: string; size: string | null; quantity: number }[];
};
export function PromoOrderHistory({ promoId, code, redeemed }: { promoId: string; code: string; redeemed: number }) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  async function load(next: string | null = null) {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/admin/promo-codes/${promoId}/orders${next ? `?cursor=${encodeURIComponent(next)}` : ""}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setEntries(previous => [...new Map([...(next ? previous : []), ...result.orders].map((item: Entry) => [item.sessionId, item])).values()] as Entry[]);
      setCursor(result.nextCursor); setLoaded(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Kunne ikke hente bestillinger"); }
    finally { setBusy(false); }
  }
  async function recover(entry: Entry) {
    setProcessing(entry.sessionId); setError("");
    try {
      const response = await fetch("/api/admin/reconcile-order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reference: entry.sessionId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setEntries(old => old.map(item => item.sessionId === entry.sessionId ? { ...item, status: "CONFIRMED", orderId: result.orderId, orderNumber: result.orderNumber, orderStatus: "PAID" } : item));
    } catch (e) { setError(e instanceof Error ? e.message : "Ordren kunne ikke færdigbehandles"); }
    finally { setProcessing(null); }
  }
  return <div className="mt-2">
    <button type="button" className="text-xs font-semibold text-secondary underline" onClick={() => { setOpen(!open); if (!open && !loaded) void load(); }}>Se bestillinger ({redeemed})</button>
    {open && <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={`Bestillinger med ${code}`}>
      <div className="mx-auto my-8 max-w-3xl rounded-xl bg-white p-6 text-left text-gray-900 shadow-xl">
        <div className="flex items-start justify-between gap-4"><h2 className="text-xl font-bold">Bestillinger med {code}</h2><button type="button" onClick={() => setOpen(false)} className="rounded border px-3 py-1">Luk</button></div>
        <p className="my-3 text-sm text-gray-600">Stripe tæller {redeemed} anvendelser. Her vises gennemførte Checkout-bestillinger med netop denne kode — også bestillinger på 0 kr., som endnu ikke er færdigbehandlet i shoppen.</p>
        <button type="button" disabled={busy || !!processing} onClick={() => void load()} className="mb-4 text-sm underline">Opdatér fra Stripe</button>
        {entries.map(entry => <div key={entry.sessionId} className="mb-3 rounded-lg border p-4">
          <div className="font-semibold">{entry.name}</div><div className="text-sm">{entry.email}</div>
          <div className="mt-1 text-sm text-gray-600">{new Intl.DateTimeFormat("da-DK", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Copenhagen" }).format(new Date(entry.created * 1000))} · {entry.total == null ? "Beløb ikke oplyst" : new Intl.NumberFormat("da-DK", { style: "currency", currency: entry.currency || "DKK" }).format(entry.total / 100)}</div>
          <ul className="my-2 text-sm">{entry.items.map((item, index) => <li key={index}>{item.quantity} × {item.name}{item.size ? ` (${item.size})` : ""}</li>)}</ul>
          {entry.status === "CONFIRMED" ? <Link className="font-semibold text-secondary underline" href={`/admin/ordrer/${entry.orderId}`}>Se ordre #{entry.orderNumber}</Link> : <p className="font-semibold text-amber-800">{entry.status === "NEEDS_PROCESSING" ? "Gennemført i Stripe — mangler færdigbehandling i shoppen" : "Ingen sikkert tilknyttet ordre fundet i shoppen"}</p>}
          {entry.status === "NEEDS_PROCESSING" && ["paid", "no_payment_required"].includes(entry.paymentStatus) && <><p className="my-2 text-xs text-gray-500">Færdigbehandling sender den normale ordrebekræftelse. Kunden opkræves ikke igen.</p><button type="button" disabled={!!processing || busy} onClick={() => void recover(entry)} className="rounded bg-secondary px-3 py-2 text-sm text-white disabled:opacity-50">{processing === entry.sessionId ? "Færdigbehandler…" : "Færdigbehandl ordre"}</button></>}
          <div className="mt-2 break-all text-xs text-gray-400">Stripe: {entry.sessionId}</div>
        </div>)}
        {busy && <p role="status">Henter fra Stripe…</p>}
        {error && <p role="alert" className="my-3 text-red-700">{error}</p>}
        {loaded && !busy && <p className="text-sm text-gray-600">{entries.length} bestillinger fundet.{!cursor && entries.length < redeemed ? " Antallet stemmer ikke med Stripes tæller. De resterende anvendelser skal undersøges i Stripe; de markeres ikke som fundet." : ""}</p>}
        {cursor && <button type="button" disabled={busy || !!processing} className="mt-3 rounded border p-2" onClick={() => void load(cursor)}>Søg videre i ældre bestillinger</button>}
      </div>
    </div>}
  </div>;
}
