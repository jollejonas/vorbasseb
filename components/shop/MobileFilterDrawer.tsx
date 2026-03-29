"use client";

import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { FilterContent, type FilterSearchParams } from "./FilterContent";

type Props = {
  categories: { name: string; slug: string; children: { name: string; slug: string }[] }[];
  sizeOptions: string[];
  searchParams: FilterSearchParams;
};

export function MobileFilterDrawer({
  categories,
  sizeOptions,
  searchParams,
}: Props) {
  const [open, setOpen] = useState(false);

  const activeCount = [
    searchParams.kategori,
    searchParams.size,
    searchParams.tilgaengelig === "1" ? "1" : undefined,
    searchParams.sort,
  ].filter(Boolean).length;

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:border-secondary transition md:hidden"
      >
        <SlidersHorizontal size={16} />
        Filter
        {activeCount > 0 && (
          <span className="ml-1 bg-secondary text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {activeCount}
          </span>
        )}
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 left-0 h-full w-72 max-w-[85vw] bg-white z-50 shadow-xl transition-transform duration-300 md:hidden overflow-y-auto ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <span className="font-semibold text-gray-900">Filter</span>
          <button
            onClick={() => setOpen(false)}
            className="p-1 rounded hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-4">
          <FilterContent
            categories={categories}
            sizeOptions={sizeOptions}
            searchParams={searchParams}
          />
        </div>
      </div>
    </>
  );
}
