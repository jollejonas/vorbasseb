import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getVatRate } from "@/lib/vat";
import { PakketilbudPageClient } from "@/components/shop/PakketilbudPageClient";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await prisma.pakketilbud.findUnique({ where: { slug } });
  return { title: p?.name ?? "Pakketilbud" };
}

export default async function PakketilbudPage({ params }: Props) {
  const { slug } = await params;

  const [pakketilbud, vatPct] = await Promise.all([
    prisma.pakketilbud.findUnique({
      where: { slug, published: true },
      include: {
        items: {
          include: {
            product: {
              include: {
                optionGroups: {
                  include: {
                    values: {
                      include: { globalColor: true, skuValues: true },
                      orderBy: { position: "asc" },
                    },
                  },
                  orderBy: { position: "asc" },
                },
                _count: { select: { skus: { where: { stock: { gt: 0 } } } } },
                skus: {
                  where: { colorVariantId: null },
                  include: { optionValues: { select: { optionValueId: true } } },
                },
                colorVariants: {
                  include: { skus: { orderBy: { size: "asc" } } },
                  orderBy: { position: "asc" },
                },
              },
            },
          },
          orderBy: { position: "asc" },
        },
      },
    }),
    getVatRate(),
  ]);

  if (!pakketilbud) notFound();

  // A pakketilbud is sold out if any item has zero in-stock SKUs (all stock ≤ 0)
  const soldOutItems = pakketilbud.items
    .map((item) => {
      const outOfStock = item.product._count.skus === 0;
      return outOfStock ? (item.label ?? item.product.name) : null;
    })
    .filter(Boolean) as string[];

  const isSoldOut = soldOutItems.length > 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-6">
        <Link href="/butik" className="hover:text-secondary">Butik</Link>
        {" / "}
        <span className="text-gray-900">{pakketilbud.name}</span>
      </nav>

      <PakketilbudPageClient
        pakketilbud={pakketilbud}
        vatPct={vatPct}
        isSoldOut={isSoldOut}
        soldOutItems={soldOutItems}
      />
    </div>
  );
}
