"use client";

import { useState } from "react";

export function BookkeepingExport() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function download(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/admin/bookkeeping-export?${new URLSearchParams({ from, to })}`);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Eksporten kunne ikke hentes. Prøv igen.");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url; link.download = `VBK-bogfoering-${from}-${to}.csv`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("Filen er hentet. Gem den sammen med Stripe-rapporten. Ordrerne er ikke markeret som bogført.");
    } catch (error) { setError(error instanceof Error ? error.message : "Eksporten kunne ikke hentes."); }
    finally { setLoading(false); }
  }

  return <details className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
    <summary className="cursor-pointer font-semibold">Eksportér til bogføring</summary>
    <p className="mt-3 text-sm text-gray-600">Hent en CSV-fil til NemSports bogholder med én række pr. bekræftet ordre. Vælg ordredatoer (dansk tid, begge datoer medregnes). Eksporten er uafhængig af filtrene i ordrelisten.</p>
    <form onSubmit={download} className="my-4 flex flex-wrap items-end gap-3">
      <label className="text-sm">Fra dato<input type="date" required value={from} onChange={e => setFrom(e.target.value)} className="mt-1 block rounded-lg border p-2" /></label>
      <label className="text-sm">Til dato<input type="date" required min={from || undefined} value={to} onChange={e => setTo(e.target.value)} className="mt-1 block rounded-lg border p-2" /></label>
      <button disabled={loading} className="rounded-lg bg-secondary px-4 py-2 font-semibold text-white disabled:opacity-50">{loading ? "Henter…" : "Hent bogføringsfil (CSV)"}</button>
    </form>
    <p className="text-sm text-gray-600">Beløb er i DKK. Rabat og fragt fremgår separat, men er allerede medregnet i totalen. Afbrudte betalinger er udeladt. Refunderede ordrer vises med deres oprindelige beløb og en markering til kontrol.</p>
    <p className="mt-2 text-sm text-gray-600">Vedlæg Stripes rapport for refusioner, gebyrer og udbetalinger — også refusioner af ældre ordrer. Momsfordeling er ikke specificeret i filen. Bogholderen skal kontrollere moms og forudbetalinger. Filen er et arbejdsgrundlag, ikke en færdig import til e-conomic.</p>
    <p className="mt-2 text-sm text-gray-600">Eksport ændrer ingen ordrer. Aftal med bogholderen, hvilke perioder og ordrenumre der er bogført, så overlappende eksporter ikke bogføres to gange.</p>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="mt-3 text-sm text-green-700">{message}</p>}
  </details>;
}
