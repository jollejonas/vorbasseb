import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProductForm } from "@/components/admin/ProductForm";

export const metadata: Metadata = { title: "Rediger produkt – Admin" };

type Props = { params: Promise<{ id: string }> };

export default async function RedigerProduktPage({ params }: Props) {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") redirect("/");

  const { id } = await params;
  const [product, designerLogos] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        skus: { include: { optionValues: { select: { optionValueId: true } } }, orderBy: { size: "asc" } },
        category: true,
        colorVariants: { include: { skus: { orderBy: { size: "asc" } } }, orderBy: { position: "asc" } },
        optionGroups: {
          include: {
            values: { include: { globalColor: true }, orderBy: { position: "asc" } },
          },
          orderBy: { position: "asc" },
        },
        designerZones: { include: { fixedLogo: true }, orderBy: { positionOrd: "asc" } },
      },
    }),
    prisma.designerLogo.findMany({ orderBy: { id: "asc" } }),
  ]);

  if (!product) notFound();

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center gap-4 mb-8">
        <a
          href="/admin/produkter"
          className="text-sm text-gray-500 hover:text-secondary"
        >
          ← Produkter
        </a>
        <h1 className="text-3xl font-bold">Rediger produkt</h1>
      </div>
      <ProductForm product={product} designerLogos={designerLogos} />
    </div>
  );
}
