"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";

const STATUS_GROUPS = [
  { value: "", label: "Alle ordrer" },
  { value: "active", label: "Aktive" },
  { value: "PAID", label: "Betalt" },
  { value: "SHIPPED", label: "Afsendt" },
  { value: "AWAITING_PICKUP", label: "Afventer afhentning" },
  { value: "PICKUP_READY", label: "Klar til afhentning" },
  { value: "DELIVERED", label: "Leveret" },
  { value: "CANCELLED", label: "Annulleret" },
  { value: "REFUNDED", label: "Refunderet" },
];

export function OrderFilters({ total }: { total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  const status = searchParams.get("status") ?? "";
  const levering = searchParams.get("levering") ?? "";
  const q = searchParams.get("q") ?? "";

  return (
    <div className="flex flex-wrap gap-3 items-center mb-6">
      {/* Status filter */}
      <select
        value={status}
        onChange={(e) => update("status", e.target.value)}
        className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
      >
        {STATUS_GROUPS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      {/* Delivery method filter */}
      <select
        value={levering}
        onChange={(e) => update("levering", e.target.value)}
        className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
      >
        <option value="">Alle leveringer</option>
        <option value="SHIPPING">Levering</option>
        <option value="PICKUP">Afhentning</option>
      </select>

      {/* Text search */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const input = (e.currentTarget.elements.namedItem("q") as HTMLInputElement).value;
          update("q", input);
        }}
        className="flex gap-1"
      >
        <input
          name="q"
          defaultValue={q}
          placeholder="Søg kunde eller e-mail..."
          className="border rounded-lg px-3 py-2 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-secondary"
        />
        <button
          type="submit"
          className="bg-secondary text-white px-3 py-2 rounded-lg text-sm hover:bg-secondary-dark transition"
        >
          Søg
        </button>
        {q && (
          <button
            type="button"
            onClick={() => update("q", "")}
            className="text-xs text-gray-400 hover:text-gray-600 px-1"
          >
            ✕
          </button>
        )}
      </form>

      <span className="text-sm text-gray-400 ml-auto">{total} {total === 1 ? "ordre" : "ordrer"}</span>
    </div>
  );
}
