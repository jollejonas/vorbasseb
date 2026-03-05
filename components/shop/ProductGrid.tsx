import { ProductCard } from "./ProductCard";
import type { Product } from "@prisma/client";

type ProductWithSkus = Product & { skus: { stock: number }[] };

export function ProductGrid({ products, vatPct = 25 }: { products: ProductWithSkus[]; vatPct?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} index={i} vatPct={vatPct} />
      ))}
    </div>
  );
}
