import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AdminProductsClient } from "@/components/admin/AdminProductsClient";

export const metadata: Metadata = { title: "Produkter – Admin" };

export default async function AdminProdukterPage() {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") redirect("/");

  const products = await prisma.product.findMany({
    include: { skus: true, category: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <a
            href="/admin"
            className="text-sm text-gray-500 hover:text-secondary"
          >
            ← Admin
          </a>
          <h1 className="text-3xl font-bold">Produkter</h1>
        </div>
        <a
          href="/admin/produkter/ny"
          className="bg-primary text-secondary font-bold px-5 py-2 rounded-xl hover:bg-primary-dark transition text-sm"
        >
          + Nyt produkt
        </a>
      </div>

      <AdminProductsClient products={products} />
    </div>
  );
}
