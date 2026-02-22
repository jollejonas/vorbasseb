import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ProductGrid } from "@/components/shop/ProductGrid";
import type { Prisma } from "@prisma/client";

export const metadata: Metadata = { title: "Butik" };

type Props = {
  searchParams: Promise<{ kategori?: string; q?: string; sort?: string; tilgaengelig?: string }>;
};

export default async function ButikPage({ searchParams }: Props) {
  const { kategori, q, sort, tilgaengelig } = await searchParams;

  const categories = await prisma.category.findMany({ orderBy: { position: "asc" } });

  const where: Prisma.ProductWhereInput = {
    published: true,
    ...(kategori ? { category: { slug: kategori } } : {}),
    ...(tilgaengelig === "1" ? { skus: { some: { stock: { gt: 0 } } } } : {}),
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

  const buildHref = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { kategori, q, sort, tilgaengelig, ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v);
    }
    const str = params.toString();
    return `/butik${str ? `?${str}` : ""}`;
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-2">Butik</h1>
      <p className="text-gray-500 mb-8">Officielt Vorbasse Boldklub merchandise</p>

      {/* Search + Sort */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <form method="GET" className="flex gap-2 flex-1">
          <input
            name="q"
            defaultValue={q}
            placeholder="Søg produkter..."
            className="border rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-secondary"
          />
          {kategori && <input type="hidden" name="kategori" value={kategori} />}
          {tilgaengelig && <input type="hidden" name="tilgaengelig" value={tilgaengelig} />}
          {sort && <input type="hidden" name="sort" value={sort} />}
          <button
            type="submit"
            className="bg-secondary text-white px-4 py-2 rounded-lg text-sm hover:bg-secondary-dark transition"
          >
            Søg
          </button>
        </form>

        {/* Sort */}
        <div className="flex gap-2 items-center">
          <span className="text-sm text-gray-500 whitespace-nowrap">Sortér:</span>
          <div className="flex gap-1">
            {[
              { label: "Nyeste", value: "" },
              { label: "Pris ↑", value: "price_asc" },
              { label: "Pris ↓", value: "price_desc" },
            ].map((s) => (
              <a
                key={s.value}
                href={buildHref({ sort: s.value || undefined })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                  (sort ?? "") === s.value
                    ? "bg-secondary text-white border-secondary"
                    : "bg-white text-gray-700 border-gray-200 hover:border-secondary"
                }`}
              >
                {s.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Category filter pills */}
      <div className="flex gap-2 flex-wrap mb-4">
        <a
          href={buildHref({ kategori: undefined })}
          className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
            !kategori
              ? "bg-secondary text-white border-secondary"
              : "bg-white text-gray-700 border-gray-200 hover:border-secondary"
          }`}
        >
          Alle
        </a>
        {categories.map((c) => (
          <a
            key={c.id}
            href={buildHref({ kategori: c.slug })}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
              kategori === c.slug
                ? "bg-secondary text-white border-secondary"
                : "bg-white text-gray-700 border-gray-200 hover:border-secondary"
            }`}
          >
            {c.name}
          </a>
        ))}
      </div>

      {/* Availability toggle */}
      <div className="mb-8">
        <a
          href={buildHref({ tilgaengelig: tilgaengelig === "1" ? undefined : "1" })}
          className={`inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border transition ${
            tilgaengelig === "1"
              ? "bg-secondary text-white border-secondary"
              : "bg-white text-gray-600 border-gray-200 hover:border-secondary"
          }`}
        >
          <span
            className={`w-4 h-4 rounded border flex items-center justify-center text-xs ${
              tilgaengelig === "1" ? "bg-white border-white text-secondary font-bold" : "border-gray-400"
            }`}
          >
            {tilgaengelig === "1" && "✓"}
          </span>
          Kun tilgængelige
        </a>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-400 text-lg mb-2">Ingen produkter fundet</p>
          <a href="/butik" className="text-secondary underline text-sm">
            Vis alle produkter
          </a>
        </div>
      ) : (
        <ProductGrid products={products} />
      )}
    </div>
  );
}
