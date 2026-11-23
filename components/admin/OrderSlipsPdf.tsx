"use client";
import { useState } from "react";
import { orderSlipDocument, type Slip } from "@/lib/order-slip-document";

async function thumbnail(src: string): Promise<string | undefined> {
  try {
    const url = new URL(src, location.origin);
    if (url.origin !== location.origin && url.origin !== "https://res.cloudinary.com") return;
    const response = await fetch(url, { signal: AbortSignal.timeout(6000), credentials: "omit" });
    if (!response.ok) return;
    const bitmap = await createImageBitmap(await response.blob());
    const scale = Math.min(1, 140 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas.toDataURL("image/png");
  } catch { return; }
}

export default function OrderSlipsPdf() {
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  async function download() {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/admin/ordresedler", { cache: "no-store" });
      if (!res.ok) throw new Error(res.status === 403 ? "Log ind som administrator for at hente ordresedlerne." : "Ordresedlerne kunne ikke hentes.");
      const slips: Slip[] = await res.json();
      if (!slips.length) { setError("Der er ingen aktive ordrer at eksportere."); return; }
      const [{default: pdf}, {default: fonts}] = await Promise.all([import("pdfmake/build/pdfmake"), import("pdfmake/build/vfs_fonts")]);
      const urls = [...new Set(slips.flatMap(o => o.items.flatMap(i => i.photo ? [i.photo] : [])))];
      const images: Record<string,string> = {};
      const names = new Map<string,string>();
      for (let i = 0; i < urls.length; i += 6) await Promise.all(urls.slice(i,i+6).map(async (url,j) => {
        const data = await thumbnail(url);
        if (data) { const key = "photo" + (i+j); images[key] = data; names.set(url,key); }
      }));
      const doc = orderSlipDocument(slips, images, names);
      await new Promise<void>(resolve => pdf.createPdf(doc, undefined, undefined, fonts).download("VBK-aktive-ordresedler.pdf", resolve));
    } catch(e) { setError(e instanceof Error ? e.message : "PDF-filen kunne ikke oprettes."); }
    finally { setBusy(false); }
  }
  return <div><button type="button" disabled={busy} onClick={download} className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white">{busy ? "Opretter PDF…" : "Hent alle aktive ordresedler (PDF)"}</button>{error && <p role="alert">{error}</p>}</div>;
}
