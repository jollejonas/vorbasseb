import { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AddToCartSection } from "@/components/shop/AddToCartSection";
import { ProductImageGallery } from "@/components/shop/ProductImageGallery";
import { formatPrice } from "@/lib/utils";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await prisma.product.findUnique({ where: { slug } });
  return { title: p?.name ?? "Produkt" };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await prisma.product.findUnique({
    where: { slug, published: true },
    include: {
      skus: { orderBy: { size: "asc" } },
      category: true,
    },
  });

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

      <div className="grid md:grid-cols-2 gap-10">
        {/* Image gallery */}
        <ProductImageGallery images={product.images} name={product.name} />

        {/* Info + Add to cart */}
        <div>
          {product.membersOnly && (
            <span className="inline-block bg-secondary text-white text-xs font-semibold px-3 py-1 rounded-full mb-3">
              Kun for fanklubsmedlemmer
            </span>
          )}

          <h1 className="text-2xl font-bold mb-1">{product.name}</h1>
          <p className="text-xl font-bold text-secondary mb-4">
            {formatPrice(product.price)}
            {product.customizationFee && (
              <span className="text-sm text-gray-500 font-normal ml-2">
                + {formatPrice(product.customizationFee)} for tryk
              </span>
            )}
          </p>

          <p className="text-gray-600 mb-6 leading-relaxed">{product.description}</p>

          <AddToCartSection product={product} skus={product.skus} />
        </div>
      </div>
    </div>
  );
}
