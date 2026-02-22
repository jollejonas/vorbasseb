"use client";

import Image from "next/image";
import { toast } from "sonner";
import { formatPrice } from "@/lib/utils";
import type { Product, SKU, Category } from "@prisma/client";

type ProductWithSkus = Product & { skus: SKU[]; category: Category | null };

export function AdminProductsClient({ products }: { products: ProductWithSkus[] }) {
  async function togglePublished(product: ProductWithSkus) {
    const res = await fetch(`/api/products/${product.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...product, published: !product.published }),
    });
    if (res.ok) {
      toast.success(
        product.published ? "Produkt skjult" : "Produkt udgivet",
      );
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

  const totalStock = (p: ProductWithSkus) =>
    p.skus.reduce((s, sku) => s + sku.stock, 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-gray-500">
            <th className="pb-3 pr-4 font-medium">Produkt</th>
            <th className="pb-3 pr-4 font-medium">Kategori</th>
            <th className="pb-3 pr-4 font-medium">Pris</th>
            <th className="pb-3 pr-4 font-medium">Lager</th>
            <th className="pb-3 pr-4 font-medium">Status</th>
            <th className="pb-3 font-medium">Handlinger</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {products.map((p) => (
            <tr key={p.id}>
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
              <td className="py-4 pr-4 text-gray-600">
                {p.category?.name ?? "—"}
              </td>
              <td className="py-4 pr-4 font-medium">{formatPrice(p.price)}</td>
              <td className="py-4 pr-4">
                <span
                  className={
                    totalStock(p) === 0 ? "text-red-500" : "text-gray-700"
                  }
                >
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
    </div>
  );
}
