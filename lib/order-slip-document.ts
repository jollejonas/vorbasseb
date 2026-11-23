import type { Content, CustomTableLayout, TableCell, TDocumentDefinitions } from "pdfmake/interfaces";

export type Slip = {
  number: number; date: string; status: string; customer: string; customerNumber?: number;
  email: string; phone: string; pickup: boolean; address: string; hold?: string;
  shipping: number; discount: number; amounts: { gross: number; net: number; vat: number; rate: number };
  items: { product: string; bundle?: string; itemNumber: string; size: string; color: string;
    print: string; quantity: number; amount: number | null; photo?: string }[];
};

const ink = "#172033";
const blue = "#1e398b";
const money = (value: number) => (value / 100).toLocaleString("da-DK", { style: "currency", currency: "DKK" });
const date = (value: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("da-DK", { ...options, timeZone: "Europe/Copenhagen" }).format(new Date(value));
const statuses: Record<string, string> = {
  PAID: "Betalt", SHIPPED: "Afsendt", AWAITING_PICKUP: "Afventer afhentning",
  PICKUP_READY: "Klar til afhentning", DELIVERED: "Leveret",
};

function frame(color = ink, inset = 14): CustomTableLayout {
  return {
    hLineWidth: () => 0.7, vLineWidth: () => 0.7, hLineColor: () => color, vLineColor: () => color,
    paddingLeft: () => inset, paddingRight: () => inset, paddingTop: () => inset, paddingBottom: () => inset,
  };
}

function productTable(order: Slip, names: Map<string, string>): Content {
  const body: TableCell[][] = [
    [{ text: "Produkter", bold: true, colSpan: 7, margin: [7, 3, 0, 3] }, "", "", "", "", "", ""],
    ["Produkt", "Varenr.", "Størrelse", "Farve", "Tryk", "Antal", "Beløb*"].map((text, i) =>
      ({ text, alignment: i >= 5 ? "right" : "left" })),
  ];
  for (const item of order.items) {
    if (item.bundle && item.amount !== null) {
      body.push([{ text: item.bundle + "  ·  Pakketilbud", bold: true, colSpan: 5 }, "", "", "", "",
        { text: item.quantity, alignment: "right" }, { text: money(item.amount), alignment: "right" }]);
    }
    const photo = item.photo && names.get(item.photo);
    body.push([{ columns: [
      photo ? { image: photo, fit: [46, 58], width: 46 } : { text: "Intet billede", fontSize: 7, color: "#667085", width: 46 },
      { text: item.product, width: "*" },
    ], columnGap: 8 }, item.itemNumber || "–", item.size || "–", item.color || "–", item.print || "–",
    { text: item.bundle ? "" : String(item.quantity), alignment: "right" },
    { text: item.bundle || item.amount === null ? "" : money(item.amount), alignment: "right" }]);
  }
  return { table: { widths: ["*", 58, 47, 31, 45, 27, 57], headerRows: 2, body },
    layout: { ...frame(ink, 5), vLineWidth: (i) => i === 0 || i === 7 ? 0.7 : 0,
      hLineColor: (i) => i <= 2 || i === body.length ? ink : "#e2e6ec", paddingTop: () => 7, paddingBottom: () => 7 } };
}

export function orderSlipDocument(slips: Slip[], images: Record<string, string>, names: Map<string, string>): TDocumentDefinitions {
  const content: Content[] = [];
  for (const o of slips) {
    content.push(
      { text: "VORBASSE BOLDKLUB · SHOP", bold: true, color: blue, characterSpacing: 1, fontSize: 9,
        pageBreak: content.length ? "before" : undefined },
      { text: "Ordreoversigt", bold: true, fontSize: 22, margin: [0, 6, 0, 6] },
      { text: date(o.date, { dateStyle: "long" }) + " · shop.vorbasseboldklub.dk" },
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: 543, y2: 0, lineColor: blue, lineWidth: 3 }], margin: [0, 16, 0, 17] },
      { columns: [{ text: "Ordre #" + o.number, fontSize: 18, bold: true, width: "auto" },
        { text: statuses[o.status] ?? o.status, color: "#475569", fontSize: 9, margin: [0, 6, 0, 0] }],
        columnGap: 17, margin: [0, 0, 0, 24] },
    );
    if (o.hold) {
      const held = new Date(o.hold).getTime() > Date.now();
      content.push({ table: { widths: ["*"], body: [[{ columns: [
        { width: 14, svg: held
          ? '<svg viewBox="0 0 16 20" width="14" height="17"><path fill="none" stroke="#596273" stroke-width="1.5" d="M2 1h12M2 19h12M3 2c0 5 2 6 5 8-3 2-5 3-5 8h10c0-5-2-6-5-8 3-2 5-3 5-8z"/><path fill="#b98a50" d="m5 6 3 3 3-3zm-1 11 4-4 4 4z"/></svg>'
          : '<svg viewBox="0 0 16 16" width="14" height="14"><path fill="none" stroke="#166534" stroke-width="2" d="m2 8 4 4 8-9"/></svg>' },
        { stack: [
        { text: held ? "Samlebestilling — må ikke behandles endnu" : "Samlebestilling — klar til behandling", bold: true },
        { text: "Deadline: " + date(o.hold, { dateStyle: "full", timeStyle: "short" }), margin: [0, 4, 0, 0] },
      ], color: held ? blue : "#166534" }], columnGap: 9 }]] }, layout: frame(held ? "#bfdbfe" : "#bbf7d0", 11), margin: [0, 0, 0, 17] });
    }
    const method = o.pickup ? "Afhentning ved klubben" : "Forsendelse";
    const details = ["Navn: " + (o.customer || "–"), "E-mail: " + (o.email || "–"), "Telefon: " + (o.phone || "–"),
      ...(o.customerNumber ? ["Kundenr.: #" + o.customerNumber] : []), "Levering: " + method];
    content.push({ table: { widths: ["*", 11, "*"], body: [[
      { stack: [{ text: "Kunde", bold: true, margin: [0, 0, 0, 5] },
        ...details.map(text => ({ text, margin: [0, 7, 0, 0] as [number, number, number, number] }))] },
      { text: "", border: [true, false, true, false] },
      { stack: [{ text: o.pickup ? "Afhentning" : "Leveringsadresse", bold: true, margin: [0, 0, 0, 12] },
        o.pickup ? "Afhentning ved klubben. Du får besked, når ordren er klar." : o.address || "Ingen adresse gemt"] },
    ]] }, layout: { ...frame(), paddingLeft: i => i === 1 ? 0 : 14, paddingRight: i => i === 1 ? 0 : 14 },
      margin: [0, 0, 0, 23] }, productTable(o, names),
    { text: "* Varebeløb er ekskl. moms. Ordrens total er inkl. moms.", fontSize: 9, margin: [0, 22, 0, 15] });
    const totals = [
      ["Fragt", o.shipping ? money(o.shipping) : "Gratis"],
      ...(o.discount ? [["Rabat (fanklub)", "−" + money(o.discount)]] : []),
      ["I alt ekskl. moms", money(o.amounts.net)], [o.amounts.rate + "% moms", money(o.amounts.vat)],
      ["I alt inkl. moms", money(o.amounts.gross)],
    ];
    content.push({ unbreakable: true, columns: [{ text: "", width: "*" }, { width: 241, table: { widths: ["*"], body: [[{
      table: { widths: ["*", "auto"], body: totals.map(([label, value], i) =>
        [label, value].map((text, j) => ({ text, alignment: j ? "right" : "left", bold: i === totals.length - 1,
          color: label === "Rabat (fanklub)" ? "#16803a" : ink }))) },
      layout: { ...frame(ink, 0), vLineWidth: () => 0, hLineWidth: i => i === totals.length - 1 ? 1 : 0,
        paddingTop: () => 3, paddingBottom: () => 3 },
    }]] }, layout: frame() }] });
  }
  return { content, images, pageSize: "A4", pageMargins: [26, 28, 26, 28],
    defaultStyle: { fontSize: 10.5, color: ink }, info: { title: "VBK – aktive ordresedler" } };
}
