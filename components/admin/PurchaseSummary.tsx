"use client";
import { useState } from "react";
import Link from "next/link";
import { PurchaseLine, summarizePurchases, purchaseCsv, purchaseClipboard, purchaseHeaders, purchaseCells } from "@/lib/purchase-summary";

export function PurchaseSummary({ lines }: { lines: PurchaseLine[] }) {
  const [product, setProduct] = useState("");
  const [status, setStatus] = useState("PAID");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [feedback, setFeedback] = useState("");
  const products = [...new Set(lines.map(line => line.product))].sort((a, b) => a.localeCompare(b, "da"));
  const filtered = lines.filter(line => (!product || line.product === product) && (!status || line.status === status) && (!from || line.date >= from) && (!to || line.date <= to));
  const rows = summarizePurchases(filtered);
  const units = rows.reduce((sum, row) => sum + row.quantity, 0);
  const orderCount = new Set(filtered.map(row => row.orderNumber)).size;
  const selected = `${product || "Alle produkter"} · ${status === "PAID" ? "Betalt" : "Alle bekræftede ordrer"} · ${from || "Alle datoer"}${to ? ` til ${to}` : ""}`;
  return <div className="purchase-export mx-auto max-w-7xl px-4 py-10">
    <Link href="/admin/ordrer" className="text-sm text-gray-500 underline print:hidden">← Ordrer</Link>
    <h1 className="mt-4 text-3xl font-bold">Samlet bestillingsliste</h1>
    <p className="mt-2 text-gray-600 print:hidden">Summen af varer pr. produkt, størrelse, farve og tryk. Ordrer på 0 kr. tælles med. Annullerede og refunderede ordrer er udeladt.</p>
    <div className="my-6 grid gap-3 sm:grid-cols-4 print:hidden">
      <label className="text-sm">Produkt<select value={product} onChange={e => setProduct(e.target.value)} className="mt-1 block w-full rounded border bg-white p-2"><option value="">Alle produkter</option>{products.map(p => <option key={p}>{p}</option>)}</select></label>
      <label className="text-sm">Ordrer<select value={status} onChange={e => setStatus(e.target.value)} className="mt-1 block w-full rounded border bg-white p-2"><option value="PAID">Betalt — klar til bestilling</option><option value="">Alle bekræftede (også afsendte/leverede)</option></select></label>
      <label className="text-sm">Ordredato fra<input type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} className="mt-1 block w-full rounded border p-2" /></label>
      <label className="text-sm">Ordredato til<input type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} className="mt-1 block w-full rounded border p-2" /></label>
    </div>
    <p className="my-4 text-sm text-gray-600">{selected}</p>
    <p className="my-4 text-lg font-semibold">{orderCount} ordrer · {units} stk. i alt</p>
    <div className="mb-5 flex flex-wrap gap-3 print:hidden">
      <button disabled={!rows.length} onClick={() => { const url = URL.createObjectURL(new Blob([purchaseCsv(rows)], { type: "text/csv;charset=utf-8" })); const a = document.createElement("a"); a.href = url; a.download = "VBK-bestillingsliste.csv"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }} className="rounded bg-secondary px-4 py-2 text-white disabled:opacity-50">Hent til Excel (CSV)</button>
      <button disabled={!rows.length} onClick={() => window.print()} className="rounded border px-4 py-2 disabled:opacity-50">Print / gem som PDF</button>
      <button disabled={!rows.length} onClick={async () => { try { await navigator.clipboard.writeText(purchaseClipboard(rows)); setFeedback("Listen er kopieret — klar til at sætte ind i Excel eller din bestilling."); } catch { setFeedback("Kunne ikke kopiere automatisk. Markér tabellen nedenfor, eller hent CSV-filen."); } }} className="rounded border px-4 py-2 disabled:opacity-50">Kopiér bestillingsliste</button>
    </div>
    {feedback && <p role="status" className="mb-4 text-sm print:hidden">{feedback}</p>}
    <div className="overflow-x-auto print:overflow-visible"><table className="w-full border-collapse text-left text-sm">
      <thead><tr>{purchaseHeaders.map(header => <th key={header} className="border-b-2 px-3 py-3">{header}</th>)}</tr></thead>
      <tbody>{purchaseCells(rows).slice(1).map((row, index) => <tr key={index}>{row.map((cell, column) => <td key={column} className={`border-b px-3 py-3 ${column === 5 ? "font-bold" : ""}`}>{cell || "–"}</td>)}</tr>)}</tbody>
      <tfoot><tr><td colSpan={5} className="px-3 py-4 font-bold">Antal i alt</td><td className="px-3 py-4 font-bold">{units}</td><td /></tr></tfoot>
    </table></div>
    {!rows.length && <p className="py-6 text-gray-500">Ingen varer matcher de valgte filtre.</p>}
    <p className="mt-6 text-xs text-gray-500">Pakketilbud er opdelt i deres enkelte produkter. Forskellige navne, numre og øvrige tryk står på separate linjer. Listen ændrer ikke ordrernes status og markerer dem ikke som bestilt.</p>
  </div>;
}
