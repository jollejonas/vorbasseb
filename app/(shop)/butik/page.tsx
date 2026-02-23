import { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ProductGrid } from "@/components/shop/ProductGrid";
import { FilterContent } from "@/components/shop/FilterContent";
import { MobileFilterDrawer } from "@/components/shop/MobileFilterDrawer";
import type { Prisma } from "@prisma/client";
import { X } from "lucide-react";

export const metadata: Metadata = { title: "Butik" };

// Canonical clothing size order (smallest → largest, then children by age)
const SIZE_ORDER = [
  "XXS", "XS", "S", "M", "L", "XL", "XXL", "2XL", "3XL",
  "116", "128", "140", "152", "164", "176",
];

function sortSizes(sizes: string[]): string[] {
  return [...sizes].sort((a, b) => {
    const ai = SIZE_ORDER.indexOf(a.toUpperCase());
    const bi = SIZE_ORDER.indexOf(b.toUpperCase());
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

type Props = {
  searchParams: Promise<{
    kategori?: string;
    q?: string;
    sort?: string;
    tilgaengelig?: string;
    size?: string;
  }>;
};

export default async function ButikPage({ searchParams }: Props) {
  const { kategori, q, sort, tilgaengelig, size } = await searchParams;

  const filterParams = { kategori, q, sort, tilgaengelig, size };

  const categories = await prisma.category.findMany({
    orderBy: { position: "asc" },
  });

  // Fetch distinct in-stock sizes (scoped to current category if set)
  const sizeWhere: Prisma.SKUWhereInput = {
    stock: { gt: 0 },
    product: {
      published: true,
      ...(kategori ? { category: { slug: kategori } } : {}),
    },
  };
  const rawSizes = await prisma.sKU.findMany({
    where: sizeWhere,
    select: { size: true },
    distinct: ["size"],
  });
  const sizeOptions = sortSizes(rawSizes.map((s) => s.size));

  const where: Prisma.ProductWhereInput = {
    published: true,
    ...(kategori ? { category: { slug: kategori } } : {}),
    ...(size ? { skus: { some: { size, stock: { gt: 0 } } } } : {}),
    ...(tilgaengelig === "1" && !size
      ? { skus: { some: { stock: { gt: 0 } } } }
      : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const orderBy: Prisma.ProductOrderByWithRelationInput =
    sort === "price_asc"
      ? { price: "asc" }
      : sort === "price_desc"
        ? { price: "desc" }
        : { createdAt: "desc" };

  const products = await prisma.product.findMany({
    where,
    include: { skus: true, category: true },
    orderBy,
  });

  // Active filter pills
  const activeFilters: { label: string; removeKey: string }[] = [];
  if (kategori) {
    const cat = categories.find((c) => c.slug === kategori);
    activeFilters.push({ label: cat?.name ?? kategori, removeKey: "kategori" });
  }
  if (size) activeFilters.push({ label: `Størrelse: ${size}`, removeKey: "size" });
  if (tilgaengelig === "1")
    activeFilters.push({ label: "Kun tilgængelige", removeKey: "tilgaengelig" });
  if (sort)
    activeFilters.push({
      label: sort === "price_asc" ? "Pris: lav → høj" : "Pris: høj → lav",
      removeKey: "sort",
    });

  function buildHref(overrides: Record<string, string | undefined>): string {
    const params = new URLSearchParams();
    const merged = { ...filterParams, ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v);
    }
    const str = params.toString();
    return `/butik${str ? `?${str}` : ""}`;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-1">Butik</h1>
      <p className="text-gray-500 mb-6">
        Officielt Vorbasse Boldklub merchandise
      </p>

      {/* Search bar */}
      <form method="GET" className="flex gap-2 mb-6 max-w-xl">
        <input
          name="q"
          defaultValue={q}
          placeholder="Søg produkter..."
          className="border rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-secondary"
        />
        {kategori && <input type="hidden" name="kategori" value={kategori} />}
        {tilgaengelig && (
          <input type="hidden" name="tilgaengelig" value={tilgaengelig} />
        )}
        {sort && <input type="hidden" name="sort" value={sort} />}
        {size && <input type="hidden" name="size" value={size} />}
        <button
          type="submit"
          className="bg-secondary text-white px-4 py-2 rounded-lg text-sm hover:bg-secondary-dark transition"
        >
          Søg
        </button>
      </form>

      {/* Mobile filter drawer trigger */}
      <div className="mb-4">
        <MobileFilterDrawer
          categories={categories}
          sizeOptions={sizeOptions}
          searchParams={filterParams}
        />
      </div>

      {/* Active filter pills */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {activeFilters.map((f) => (
            <Link
              key={f.removeKey}
              href={buildHref({ [f.removeKey]: undefined })}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/10 text-secondary text-xs font-medium border border-secondary/30 hover:bg-secondary/20 transition"
            >
              {f.label}
              <X size={12} strokeWidth={2.5} />
            </Link>
          ))}
          {activeFilters.length > 1 && (
            <Link
              href="/butik"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-medium hover:bg-gray-200 transition"
            >
              Ryd alle filtre
            </Link>
          )}
        </div>
      )}

      {/* Main layout: sidebar + grid */}
      <div className="flex gap-8 items-start">
        {/* Desktop sidebar */}
        <aside className="hidden md:block w-52 shrink-0 sticky top-20">
          <FilterContent
            categories={categories}
            sizeOptions={sizeOptions}
            searchParams={filterParams}
          />
        </aside>

        {/* Product grid */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-500 mb-4">
            {products.length}{" "}
            {products.length === 1 ? "produkt" : "produkter"}
          </p>
          {products.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-gray-400 text-lg mb-2">
                Ingen produkter fundet
              </p>
              <Link href="/butik" className="text-secondary underline text-sm">
                Vis alle produkter
              </Link>
            </div>
          ) : (
            <ProductGrid products={products} />
          )}
        </div>
      </div>
    </div>
  );
}
