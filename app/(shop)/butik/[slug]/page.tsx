import { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getVatRate } from "@/lib/vat";
import { ProductColorSection } from "@/components/shop/ProductColorSection";
import { ProductOptionsSection } from "@/components/shop/ProductOptionsSection";
import { SimpleAddToCart } from "@/components/shop/SimpleAddToCart";
import { formatPrice, withVat } from "@/lib/utils";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await prisma.product.findUnique({ where: { slug } });
  return { title: p?.name ?? "Produkt" };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;

  const [product, vatPct] = await Promise.all([
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
      },
    }),
    getVatRate(),
  ]);

  if (!product) notFound();

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
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

      <div className="mb-6">
        {product.membersOnly && (
          <span className="inline-block bg-secondary text-white text-xs font-semibold px-3 py-1 rounded-full mb-3">
            Kun for fanklubsmedlemmer
          </span>
        )}
        <h1 className="text-2xl font-bold mb-1">{product.name}</h1>
        <p className="text-xl font-bold text-secondary mb-2">
          {formatPrice(withVat(product.price, vatPct))}
          <span className="text-sm text-gray-400 font-normal ml-1">inkl. moms</span>
          {product.customizationFee && (
            <span className="text-sm text-gray-500 font-normal ml-2">
              + {formatPrice(withVat(product.customizationFee, vatPct))} for tryk
            </span>
          )}
        </p>
        <p className="text-gray-600 leading-relaxed">{product.description}</p>
      </div>

      {product.optionGroups.length > 0 ? (
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
        />
      ) : (
        <SimpleAddToCart product={product} skus={product.skus} />
      )}
    </div>
  );
}
