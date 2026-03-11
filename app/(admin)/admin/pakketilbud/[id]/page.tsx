import { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PakketilbudForm } from "@/components/admin/PakketilbudForm";

export const metadata: Metadata = { title: "Rediger pakketilbud – Admin" };

type Params = { params: Promise<{ id: string }> };

export default async function AdminEditPakketilbudPage({ params }: Params) {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") redirect("/");

  const { id } = await params;

  const raw = await prisma.pakketilbud.findUnique({
    where: { id },
    include: {
      items: {
        include: { product: { select: { id: true, name: true, images: true, skus: { select: { costPrice: true } } } } },
        orderBy: { position: "asc" },
      },
    },
  });

  if (!raw) notFound();

  // Compute avgCostOre per item so the form can show a total cost
  const pakketilbud = {
    ...raw,
    items: raw.items.map((item) => {
      const skusWithCost = item.product.skus.filter((s) => s.costPrice !== null);
      const avgCostOre = skusWithCost.length > 0
        ? Math.round(skusWithCost.reduce((sum, s) => sum + s.costPrice!, 0) / skusWithCost.length)
        : null;
      return { ...item, avgCostOre };
    }),
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/admin/pakketilbud" className="text-sm text-gray-500 hover:text-secondary">
          ← Pakketilbud
        </Link>
        <h1 className="text-2xl font-bold">Rediger: {pakketilbud.name}</h1>
      </div>
      <PakketilbudForm pakketilbud={pakketilbud} />
    </div>
  );
}
