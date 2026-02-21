import { ProductCard } from "./ProductCard";
import type { Product, SKU } from "@prisma/client";

type ProductWithSkus = Product & { skus: SKU[] };

export function ProductGrid({ products }: { products: ProductWithSkus[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
