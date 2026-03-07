"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { formatPrice } from "@/lib/utils";
import { TrendingUp, TrendingDown, Download, ArrowUpDown } from "lucide-react";

type ProductRow = {
  id: string;
  name: string;
  priceOre: number;
  avgCostOre: number | null;
  marginOre: number | null;
  marginPct: number | null;
  skusWithCost: number;
  totalSkus: number;
  skus: { size: string; costPrice: number | null }[];
};

type Kpis = {
  totalRevenueOre: number;
  antalOrdrer: number;
  gnsOrdrevaerdiOre: number;
  gnsAvancePct: number | null;
};

type Props = {
  productRows: ProductRow[];
  kpis: Kpis;
  period: string;
};

type SortKey = "name" | "price" | "cost" | "marginKr" | "marginPct";

const PERIODS = [
  { key: "30d", label: "Sidste 30 dage" },
  { key: "1y", label: "Dette år" },
  { key: "all", label: "Alle tider" },
];

function fmt(ore: number | null): string {
  if (ore === null) return "—";
  return formatPrice(ore);
}

function pct(v: number | null): string {
  if (v === null) return "—";
  return v.toFixed(1) + " %";
}

function downloadCsv(rows: ProductRow[]) {
  const lines: string[] = [];
  lines.push("Produkter");
  lines.push("Produkt,Salgspris ekskl. moms (kr),Kostpris gns. (kr),Avance (kr),Avance (%)");
  rows.forEach((r) => {
    lines.push(
      [
        `"${r.name.replace(/"/g, '""')}"`,
        r.priceOre !== null ? (r.priceOre / 100).toFixed(2) : "",
        r.avgCostOre !== null ? (r.avgCostOre / 100).toFixed(2) : "",
        r.marginOre !== null ? (r.marginOre / 100).toFixed(2) : "",
        r.marginPct !== null ? r.marginPct.toFixed(1) : "",
      ].join(",")
    );
  });
  lines.push("");
  lines.push("SKU'er");
  lines.push("Produkt,Størrelse,Kostpris (kr)");
  rows.forEach((r) => {
    r.skus.forEach((s) => {
      lines.push(
        [
          `"${r.name.replace(/"/g, '""')}"`,
          s.size,
          s.costPrice !== null ? (s.costPrice / 100).toFixed(2) : "",
        ].join(",")
      );
    });
  });

  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "oekonomi.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function OekonomiClient({ productRows, kpis, period }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [onlyWithCost, setOnlyWithCost] = useState(false);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  const filtered = useMemo(
    () => (onlyWithCost ? productRows.filter((r) => r.avgCostOre !== null) : productRows),
    [productRows, onlyWithCost]
  );

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av: number | string | null;
      let bv: number | string | null;
      if (sortKey === "name") { av = a.name; bv = b.name; }
      else if (sortKey === "price") { av = a.priceOre; bv = b.priceOre; }
      else if (sortKey === "cost") { av = a.avgCostOre; bv = b.avgCostOre; }
      else if (sortKey === "marginKr") { av = a.marginOre; bv = b.marginOre; }
      else { av = a.marginPct; bv = b.marginPct; }

      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  function SortBtn({ col, children }: { col: SortKey; children: React.ReactNode }) {
    const active = sortKey === col;
    return (
      <button
        type="button"
        onClick={() => handleSort(col)}
        className={`flex items-center gap-1 font-medium hover:text-secondary transition ${active ? "text-secondary" : "text-gray-600"}`}
      >
        {children}
        <ArrowUpDown size={12} className="opacity-50" />
      </button>
    );
  }

  return (
    <div className="space-y-8">
      {/* Period selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500 mr-1">Periode:</span>
        {PERIODS.map((p) => (
          <Link
            key={p.key}
            href={`?period=${p.key}`}
            className={`px-3 py-1.5 text-sm rounded-lg border transition ${
              period === p.key
                ? "bg-secondary text-white border-secondary"
                : "border-gray-200 text-gray-600 hover:border-gray-400"
            }`}
          >
            {p.label}
          </Link>
        ))}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Omsætning (inkl. moms)"
          value={fmt(kpis.totalRevenueOre)}
          sub={period === "all" ? "Alle tider" : period === "1y" ? "Dette år" : "Sidste 30 dage"}
        />
        <KpiCard
          label="Antal ordrer"
          value={String(kpis.antalOrdrer)}
          sub="Leverede ordrer"
        />
        <KpiCard
          label="Gns. ordreværdi"
          value={kpis.antalOrdrer > 0 ? fmt(kpis.gnsOrdrevaerdiOre) : "—"}
          sub="inkl. moms"
        />
        <KpiCard
          label="Gns. avance"
          value={pct(kpis.gnsAvancePct)}
          sub="baseret på kostpriser"
          trend={kpis.gnsAvancePct !== null ? (kpis.gnsAvancePct >= 30 ? "up" : kpis.gnsAvancePct < 10 ? "down" : null) : null}
        />
      </div>

      {/* Table controls */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={onlyWithCost}
            onChange={(e) => setOnlyWithCost(e.target.checked)}
            className="rounded"
          />
          Kun produkter med kostpris sat
        </label>
        <button
          type="button"
          onClick={() => downloadCsv(productRows)}
          className="flex items-center gap-2 text-sm px-3 py-1.5 border border-gray-200 rounded-lg hover:border-gray-400 transition text-gray-600"
        >
          <Download size={14} />
          Download CSV
        </button>
      </div>

      {/* Product table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3">
                <SortBtn col="name">Produkt</SortBtn>
              </th>
              <th className="text-right px-4 py-3">
                <SortBtn col="price">Salgspris</SortBtn>
              </th>
              <th className="text-right px-4 py-3">
                <SortBtn col="cost">Kostpris (gns.)</SortBtn>
              </th>
              <th className="text-right px-4 py-3">
                <SortBtn col="marginKr">Avance kr</SortBtn>
              </th>
              <th className="text-right px-4 py-3">
                <SortBtn col="marginPct">Avance %</SortBtn>
              </th>
              <th className="text-right px-4 py-3 text-gray-500 font-medium">SKU'er</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((row) => {
              const hasMargin = row.marginPct !== null;
              const good = hasMargin && row.marginPct! >= 30;
              const bad = hasMargin && row.marginPct! < 10;
              return (
                <tr key={row.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3 font-medium text-gray-900">{row.name}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                    {fmt(row.priceOre)}
                    <span className="text-gray-400 text-xs ml-1">ekskl. moms</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                    {fmt(row.avgCostOre)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className={hasMargin ? (good ? "text-green-600" : bad ? "text-red-500" : "text-gray-700") : "text-gray-300"}>
                      {fmt(row.marginOre)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className={`font-semibold ${hasMargin ? (good ? "text-green-600" : bad ? "text-red-500" : "text-gray-700") : "text-gray-300"}`}>
                      {pct(row.marginPct)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400 text-xs">
                    {row.skusWithCost}/{row.totalSkus}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a href={`/admin/produkter/${row.id}`} className="text-xs text-gray-400 hover:text-secondary transition">
                      Rediger
                    </a>
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">
                  Ingen produkter at vise.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        * Avance beregnet som salgspris − gennemsnitlig kostpris (ekskl. moms). Omsætning er fra ordrer med status "Leveret".
      </p>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  trend,
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: "up" | "down" | null;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 space-y-1">
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <div className="flex items-end gap-2">
        <p className="text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
        {trend === "up" && <TrendingUp size={16} className="text-green-500 mb-1" />}
        {trend === "down" && <TrendingDown size={16} className="text-red-400 mb-1" />}
      </div>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}
