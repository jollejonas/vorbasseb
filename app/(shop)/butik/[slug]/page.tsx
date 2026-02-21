import { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AddToCartSection } from "@/components/shop/AddToCartSection";
import { formatPrice } from "@/lib/utils";
import Image from "next/image";

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
    include: { skus: { orderBy: { size: "asc" } } },
  });

  if (!product) notFound();

  const CATEGORY_LABELS: Record<string, string> = {
    SPILLERTOJ: "Spillertøj",
    BLAEDNING: "Beklædning",
    MERCHANDISE: "Merchandise",
  };
  const categoryLabel = CATEGORY_LABELS[product.category] ?? product.category;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-6">
        <a href="/butik" className="hover:text-secondary">
          Butik
        </a>{" "}
        /{" "}
        <a
          href={`/butik?kategori=${product.category}`}
          className="hover:text-secondary"
        >
          {categoryLabel}
        </a>{" "}
        / <span className="text-gray-900">{product.name}</span>
      </nav>

      <div className="grid md:grid-cols-2 gap-10">
        {/* Images */}
        <div className="space-y-3">
          <div className="relative aspect-square bg-surface rounded-2xl overflow-hidden">
            {product.images[0] ? (
              <Image
                src={product.images[0]}
                alt={product.name}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
                priority
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300 text-6xl font-bold">
                VBK
              </div>
            )}
          </div>

          {product.images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {product.images.slice(1).map((img, i) => (
                <div
                  key={i}
                  className="relative w-20 h-20 shrink-0 rounded-lg overflow-hidden border border-gray-200"
                >
                  <Image
                    src={img}
                    alt={`${product.name} ${i + 2}`}
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

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

          <p className="text-gray-600 mb-6 leading-relaxed">
            {product.description}
          </p>

          <AddToCartSection product={product} skus={product.skus} />
        </div>
      </div>
    </div>
  );
}
