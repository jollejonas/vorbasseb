import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ProductGrid } from "@/components/shop/ProductGrid";

export const metadata: Metadata = { title: "Butik" };

type Props = {
  searchParams: Promise<{ kategori?: string; q?: string }>;
};

const CATEGORY_MAP: Record<string, "SPILLERTOJ" | "BLAEDNING" | "MERCHANDISE"> = {
  SPILLERTOJ: "SPILLERTOJ",
  BLAEDNING: "BLAEDNING",
  MERCHANDISE: "MERCHANDISE",
};

export default async function ButikPage({ searchParams }: Props) {
  const { kategori, q } = await searchParams;

  const categoryFilter = kategori && CATEGORY_MAP[kategori]
    ? { category: CATEGORY_MAP[kategori] }
    : {};

  const products = await prisma.product.findMany({
    where: {
      published: true,
      ...categoryFilter,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { skus: true },
    orderBy: { createdAt: "desc" },
  });

  const filters = [
    { label: "Alle", value: "" },
    { label: "Spillertøj", value: "SPILLERTOJ" },
    { label: "Beklædning", value: "BLAEDNING" },
    { label: "Merchandise", value: "MERCHANDISE" },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-2">Butik</h1>
      <p className="text-gray-500 mb-8">Officielt Vorbasse Boldklub merchandise</p>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <form method="GET" className="flex gap-2 flex-1">
          <input
            name="q"
            defaultValue={q}
            placeholder="Søg produkter..."
            className="border rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-secondary"
          />
          {kategori && <input type="hidden" name="kategori" value={kategori} />}
          <button
            type="submit"
            className="bg-secondary text-white px-4 py-2 rounded-lg text-sm hover:bg-secondary-dark transition"
          >
            Søg
          </button>
        </form>

        <div className="flex gap-2 flex-wrap">
          {filters.map((f) => (
            <a
              key={f.value}
              href={f.value ? `/butik?kategori=${f.value}${q ? `&q=${q}` : ""}` : "/butik"}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
                (kategori ?? "") === f.value
                  ? "bg-secondary text-white border-secondary"
                  : "bg-white text-gray-700 border-gray-200 hover:border-secondary"
              }`}
            >
              {f.label}
            </a>
          ))}
        </div>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-400 text-lg mb-2">Ingen produkter fundet</p>
          <a href="/butik" className="text-secondary underline text-sm">Vis alle produkter</a>
        </div>
      ) : (
        <ProductGrid products={products} />
      )}
    </div>
  );
}
