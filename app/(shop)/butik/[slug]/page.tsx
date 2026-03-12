import { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getVatRate } from "@/lib/vat";
import { ProductColorSection } from "@/components/shop/ProductColorSection";
import { ProductOptionsSection } from "@/components/shop/ProductOptionsSection";
import { SimpleAddToCart } from "@/components/shop/SimpleAddToCart";
import { JerseyDesignerSection } from "@/components/shop/JerseyDesignerSection";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await prisma.product.findUnique({ where: { slug } });
  return { title: p?.name ?? "Produkt" };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;

  const [product, vatPct, designerLogos] = await Promise.all([
    prisma.product.findUnique({
      where: { slug, published: true },
      include: {
        skus: {
          where: { colorVariantId: null },
          orderBy: { size: "asc" },
          include: { optionValues: { select: { optionValueId: true } } },
        },
        category: true,
        colorVariants: {
          include: { skus: { orderBy: { size: "asc" } } },
          orderBy: { position: "asc" },
        },
        optionGroups: {
          include: {
            values: {
              include: { globalColor: true, skuValues: true },
              orderBy: { position: "asc" },
            },
          },
          orderBy: { position: "asc" },
        },
        designerZones: { include: { fixedLogo: true }, orderBy: { positionOrd: "asc" } },
      },
    }),
    getVatRate(),
    prisma.designerLogo.findMany({ orderBy: { id: "asc" } }),
  ]);

  if (!product) notFound();

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-6">
        <a href="/butik" className="hover:text-secondary">
          Butik
        </a>
        {product.category && (
          <>
            {" / "}
            <a
              href={`/butik?kategori=${product.category.slug}`}
              className="hover:text-secondary"
            >
              {product.category.name}
            </a>
          </>
        )}
        {" / "}
        <span className="text-gray-900">{product.name}</span>
      </nav>

      {product.designerEnabled ? (
        <JerseyDesignerSection
          product={product}
          zones={product.designerZones}
          logos={designerLogos}
          skus={product.skus}
          vatPct={vatPct}
          optionGroups={product.optionGroups}
        />
      ) : product.optionGroups.length > 0 ? (
        <ProductOptionsSection
          product={product}
          skus={product.skus}
          optionGroups={product.optionGroups}
          vatPct={vatPct}
        />
      ) : product.colorVariants.length > 0 ? (
        <ProductColorSection
          product={product}
          skus={product.skus}
          colorVariants={product.colorVariants}
          vatPct={vatPct}
        />
      ) : (
        <SimpleAddToCart product={product} skus={product.skus} vatPct={vatPct} />
      )}
    </div>
  );
}
