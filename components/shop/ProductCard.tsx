import Link from "next/link";
import Image from "next/image";
import { Lock } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import type { Product, SKU } from "@prisma/client";

type ProductWithSkus = Product & { skus: SKU[] };

export function ProductCard({ product }: { product: ProductWithSkus }) {
  const inStock = product.skus.some((s) => s.stock > 0);

  return (
    <div className="group flex flex-col bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow">
      <Link href={`/butik/${product.slug}`} className="block relative aspect-square bg-gray-50 overflow-hidden">
        {product.images[0] ? (
          <Image
            src={product.images[0]}
            alt={product.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-200 text-4xl font-black">
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
      </Link>

      <div className="p-4 flex flex-col gap-3">
        <div>
          <h3 className="font-bold text-secondary text-sm leading-tight">{product.name}</h3>
          <p className="text-secondary/80 font-semibold mt-1 text-sm">
            Pris {formatPrice(product.price)}
          </p>
        </div>
        <Link
          href={`/butik/${product.slug}`}
          className="block text-center bg-secondary text-primary font-black text-xs tracking-widest py-2.5 rounded-lg hover:bg-secondary-dark transition-colors"
        >
          KØB HER
        </Link>
      </div>
    </div>
  );
}
