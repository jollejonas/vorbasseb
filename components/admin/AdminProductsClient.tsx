"use client";

import Image from "next/image";
import { toast } from "sonner";
import { formatPrice } from "@/lib/utils";
import { useRouter } from "next/navigation";
import type { Product, SKU, Category, ColorVariant } from "@prisma/client";
import type { AttentionReason } from "@/app/(admin)/admin/produkter/page";

type ProductWithDetails = Product & {
  skus: SKU[];
  category: Category | null;
  colorVariants: Pick<ColorVariant, "images">[];
  attentionReasons: AttentionReason[];
};

const REASON_LABEL: Record<AttentionReason, string> = {
  empty: "Tomt lager",
  low: "Lavt lager",
  images: "Mangler billeder",
};

const REASON_STYLE: Record<AttentionReason, string> = {
  empty: "bg-red-100 text-red-700",
  low: "bg-amber-100 text-amber-700",
  images: "bg-gray-100 text-gray-600",
};

export function AdminProductsClient({
  products,
  filterAttention,
}: {
  products: ProductWithDetails[];
  filterAttention: boolean;
}) {
  const router = useRouter();

  async function togglePublished(product: ProductWithDetails) {
    const res = await fetch(`/api/products/${product.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...product, published: !product.published }),
    });
    if (res.ok) {
      toast.success(product.published ? "Produkt skjult" : "Produkt udgivet");
      window.location.reload();
    } else {
      toast.error("Noget gik galt");
    }
  }

  async function deleteProduct(id: string, name: string) {
    if (!confirm(`Slet "${name}"? Dette kan ikke fortrydes.`)) return;
    const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Produkt slettet");
      window.location.reload();
    } else {
      toast.error("Noget gik galt");
    }
  }

  const totalStock = (p: ProductWithDetails) =>
    p.skus.reduce((s, sku) => s + sku.stock, 0);

  const attentionCount = products.filter((p) => p.attentionReasons.length > 0).length;

  return (
    <div>
      {/* Filter toggle */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => router.push("/admin/produkter?filter=attention")}
          className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border transition ${
            filterAttention
              ? "bg-red-50 border-red-300 text-red-700 font-medium"
              : "border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-600"
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
          Vis kun med advarsler
          {!filterAttention && attentionCount > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
              {attentionCount}
            </span>
          )}
        </button>
        {filterAttention && (
          <button
            onClick={() => router.push("/admin/produkter")}
            className="text-sm text-gray-500 underline hover:text-gray-800"
          >
            Vis alle
          </button>
        )}
        <span className="text-sm text-gray-400 ml-auto">
          {products.length} {products.length === 1 ? "produkt" : "produkter"}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="pb-3 pr-4 font-medium">Produkt</th>
              <th className="pb-3 pr-4 font-medium">Kategori</th>
              <th className="pb-3 pr-4 font-medium">Pris</th>
              <th className="pb-3 pr-4 font-medium">Lager</th>
              <th className="pb-3 pr-4 font-medium">Status</th>
              <th className="pb-3 pr-4 font-medium">Opmærksomhed</th>
              <th className="pb-3 font-medium">Handlinger</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {products.map((p) => (
              <tr key={p.id} className={p.attentionReasons.length > 0 ? "bg-amber-50/30" : ""}>
                <td className="py-4 pr-4">
                  <div className="flex items-center gap-3">
                    <div className="relative w-12 h-12 shrink-0 bg-surface rounded-lg overflow-hidden">
                      {p.images[0] ? (
                        <Image
                          src={p.images[0]}
                          alt={p.name}
                          fill
                          className="object-cover"
                          sizes="48px"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs font-bold">
                          VBK
                        </div>
                      )}
                    </div>
                    <span className="font-medium">{p.name}</span>
                  </div>
                </td>
                <td className="py-4 pr-4 text-gray-600">{p.category?.name ?? "—"}</td>
                <td className="py-4 pr-4 font-medium">{formatPrice(p.price)}</td>
                <td className="py-4 pr-4">
                  <span className={
                    totalStock(p) === 0 && p.skus.length > 0
                      ? "text-red-600 font-semibold"
                      : totalStock(p) <= 2 && p.skus.length > 0
                      ? "text-amber-600 font-semibold"
                      : "text-gray-700"
                  }>
                    {totalStock(p)} stk
                  </span>
                </td>
                <td className="py-4 pr-4">
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      p.published
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {p.published ? "Udgivet" : "Skjult"}
                  </span>
                </td>
                <td className="py-4 pr-4">
                  <div className="flex flex-wrap gap-1">
                    {p.attentionReasons.map((r) => (
                      <span key={r} className={`text-xs px-2 py-0.5 rounded-full font-medium ${REASON_STYLE[r]}`}>
                        {REASON_LABEL[r]}
                      </span>
                    ))}
                    {p.attentionReasons.length === 0 && (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </div>
                </td>
                <td className="py-4">
                  <div className="flex gap-3 text-xs">
                    <a
                      href={`/admin/produkter/${p.id}`}
                      className="text-secondary underline hover:text-secondary-dark"
                    >
                      Rediger
                    </a>
                    <button
                      onClick={() => togglePublished(p)}
                      className="text-gray-500 underline hover:text-gray-800"
                    >
                      {p.published ? "Skjul" : "Udgiv"}
                    </button>
                    <button
                      onClick={() => deleteProduct(p.id, p.name)}
                      className="text-red-400 underline hover:text-red-600"
                    >
                      Slet
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {products.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-12">Ingen produkter matcher filteret.</p>
        )}
      </div>
    </div>
  );
}
