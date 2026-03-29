import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CategoryManager } from "@/components/admin/CategoryManager";

export const metadata: Metadata = { title: "Kategorier" };

export default async function KategorierPage() {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") redirect("/");

  const categories = await prisma.category.findMany({
    where: { parentId: null },
    orderBy: { position: "asc" },
    include: {
      children: {
        orderBy: { position: "asc" },
        include: { _count: { select: { products: true } } },
      },
      _count: { select: { products: true } },
    },
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-8">Kategorier</h1>
      <CategoryManager initialCategories={categories} />
    </div>
  );
}
