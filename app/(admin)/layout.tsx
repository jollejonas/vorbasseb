import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";

const getAttentionCount = unstable_cache(
  async (): Promise<number> => {
    const products = await prisma.product.findMany({
      where: { published: true },
      select: {
        images: true,
        skus: { select: { stock: true } },
        colorVariants: { select: { images: true } },
      },
    });

    let count = 0;
    for (const p of products) {
      const stocks = p.skus.map((s) => s.stock);
      const totalStock = stocks.reduce((a, b) => a + b, 0);
      const hasSkus = stocks.length > 0;
      const emptyStock = hasSkus && totalStock === 0;
      const lowStock = hasSkus && !emptyStock && stocks.some((s) => s > 0 && s <= 2);
      const hasImages =
        p.images.length > 0 || p.colorVariants.some((cv) => cv.images.length > 0);
      if (emptyStock || lowStock || !hasImages) count++;
    }
    return count;
  },
  ["admin-attention-count"],
  { revalidate: 60, tags: ["admin-attention-count"] }
);

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const attentionCount = await getAttentionCount();

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar attentionCount={attentionCount} />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
