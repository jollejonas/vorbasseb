"use client";
import { useState } from "react";
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";

type Slip = { number: number; date: string; status: string; customer: string; email: string; phone: string; delivery: string; hold?: string;
  shipping: number; discount: number; amounts: { gross: number; vat: number; rate: number };
  items: { product: string; bundle?: string; itemNumber: string; size: string; color: string; print: string; quantity: number; amount: number | null; photo?: string }[] };
const money = (n: number) => (n / 100).toLocaleString("da-DK", { style: "currency", currency: "DKK" });
const date = (s: string) => new Date(s).toLocaleDateString("da-DK", { timeZone: "Europe/Copenhagen" });
const statuses: Record<string,string> = { PAID:"Betalt", SHIPPED:"Afsendt", AWAITING_PICKUP:"Afventer afhentning", PICKUP_READY:"Klar til afhentning", DELIVERED:"Leveret" };

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
      const content: Content[] = [];
      for (const o of slips) {
        content.push({text: "VORBASSE BOLDKLUB  /  SHOP", color:"#17335a", bold:true, pageBreak: content.length ? "before" : undefined},
          {text: "Ordreseddel #" + o.number, fontSize:22, bold:true, margin:[0,6,0,2]},
          {text: date(o.date) + "   ·   " + (statuses[o.status] ?? o.status), margin:[0,0,0,14]},
          {text: [o.customer,o.email,o.phone].filter(Boolean).join("   ·   ")}, {text:o.delivery,margin:[0,4,0,8]});
        if (o.hold) content.push({text:"Samlebestilling · deadline " + date(o.hold), margin:[0,0,0,8]});
        content.push({table:{headerRows:1,widths:[40,"*",35,65],body:[
          ["Foto","Produkt / variant / tryk","Antal","Beløb ekskl. moms"].map(text=>({text,bold:true,fillColor:"#edf2f7"})),
          ...o.items.map(i=>[i.photo && names.has(i.photo) ? {image:names.get(i.photo)!,fit:[36,42] as [number,number]} : "",
            [i.bundle,i.product,[i.itemNumber,i.size,i.color].filter(Boolean).join(" · "),i.print].filter(Boolean).join("\n"),String(i.quantity),i.amount === null ? "" : money(i.amount)])]},layout:"lightHorizontalLines"});
        if(o.discount) content.push({text:"Rabat: " + money(o.discount), alignment:"right"});
        content.push({text:"Fragt: " + money(o.shipping), alignment:"right",margin:[0,8,0,3]},
          {text:"Heraf moms (" + o.amounts.rate + " %): " + money(o.amounts.vat), alignment:"right"},
          {text:"I alt inkl. moms: " + money(o.amounts.gross), alignment:"right",bold:true,fontSize:13});
      }
      const doc:TDocumentDefinitions = { content,images,pageSize:"A4",defaultStyle:{fontSize:10},info:{title:"VBK – aktive ordresedler"} };
      await new Promise<void>(resolve => pdf.createPdf(doc, undefined, undefined, fonts).download("VBK-aktive-ordresedler.pdf", resolve));
    } catch(e) { setError(e instanceof Error ? e.message : "PDF-filen kunne ikke oprettes."); }
    finally { setBusy(false); }
  }
  return <div><button type="button" disabled={busy} onClick={download} className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white">{busy ? "Opretter PDF…" : "Hent alle aktive ordresedler (PDF)"}</button>{error && <p role="alert">{error}</p>}</div>;
}
