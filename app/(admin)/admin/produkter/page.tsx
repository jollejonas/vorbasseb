import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AdminProductsClient } from "@/components/admin/AdminProductsClient";

export const metadata: Metadata = { title: "Produkter – Admin" };

export type AttentionReason = "empty" | "low" | "images";

export function computeAttentionReasons(product: {
  images: string[];
  skus: { stock: number }[];
  colorVariants: { images: string[] }[];
}): AttentionReason[] {
  const stocks = product.skus.map((s) => s.stock);
  const totalStock = stocks.reduce((a, b) => a + b, 0);
  const hasSkus = stocks.length > 0;
  const emptyStock = hasSkus && totalStock === 0;
  const lowStock = hasSkus && !emptyStock && stocks.some((s) => s > 0 && s <= 2);
  const hasImages = product.images.length > 0 || product.colorVariants.some((cv) => cv.images.length > 0);

  const reasons: AttentionReason[] = [];
  if (emptyStock) reasons.push("empty");
  if (lowStock) reasons.push("low");
  if (!hasImages) reasons.push("images");
  return reasons;
}

export default async function AdminProdukterPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") redirect("/");

  const { filter } = await searchParams;
  const filterAttention = filter === "attention";

  const products = await prisma.product.findMany({
    include: { skus: true, category: true, colorVariants: { select: { images: true } } },
    orderBy: { createdAt: "desc" },
  });

  const productsWithReasons = products.map((p) => ({
    ...p,
    attentionReasons: computeAttentionReasons(p),
  }));

  const displayProducts = filterAttention
    ? productsWithReasons.filter((p) => p.attentionReasons.length > 0)
    : productsWithReasons;

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Produkter</h1>
        <a
          href="/admin/produkter/ny"
          className="bg-primary text-secondary font-bold px-5 py-2 rounded-xl hover:bg-primary-dark transition text-sm"
        >
          + Nyt produkt
        </a>
      </div>

      <AdminProductsClient
        products={displayProducts}
        filterAttention={filterAttention}
      />
    </div>
  );
}
