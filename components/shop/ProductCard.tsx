import Link from "next/link";
import Image from "next/image";
import { Lock } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import type { Product, SKU } from "@prisma/client";

type ProductWithSkus = Product & { skus: SKU[] };

export function ProductCard({ product }: { product: ProductWithSkus }) {
  const inStock = product.skus.some((s) => s.stock > 0);

  return (
    <Link
      href={`/butik/${product.slug}`}
      className="group block bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
    >
      <div className="relative aspect-square bg-surface overflow-hidden">
        {product.images[0] ? (
          <Image
            src={product.images[0]}
            alt={product.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-4xl font-bold">
            VBK
          </div>
        )}

        {product.membersOnly && (
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-secondary text-white text-xs font-semibold px-2 py-0.5 rounded-full">
            <Lock size={10} /> Kun for medlemmer
          </div>
        )}

        {!inStock && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="bg-white text-gray-800 text-xs font-bold px-3 py-1 rounded-full">
              Udsolgt
            </span>
          </div>
        )}
      </div>

      <div className="p-3">
        <h3 className="font-medium text-sm truncate">{product.name}</h3>
        <p className="text-secondary font-bold mt-1">
          {formatPrice(product.price)}
        </p>
      </div>
    </Link>
  );
}
