"use client";

import { useState } from "react";
import { useCart } from "./CartProvider";
import { formatPrice, withVat } from "@/lib/utils";
import type { Product, SKU } from "@prisma/client";

export function SimpleAddToCart({
  product,
  skus,
  vatPct,
}: {
  product: Pick<Product, "id" | "name" | "price" | "description" | "membersOnly" | "customizationFee" | "clubRoleRequired" | "images">;
  skus: SKU[];
  vatPct: number;
}) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  const availableSku = skus.find((s) => s.stock > 0) ?? skus[0] ?? null;
  const inStock = availableSku !== null && availableSku.stock > 0;

  function handleAdd() {
    if (!availableSku || !inStock) return;
    addItem({
      skuId: availableSku.id,
      productId: product.id,
      productName: product.name,
      size: availableSku.size || "One Size",
      price: product.price,
      quantity: 1,
      image: product.images[0],
      clubRoleRequired: product.clubRoleRequired ?? null,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="grid md:grid-cols-2 gap-10">
      {/* Image */}
      <div>
        {product.images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.images[0]}
            alt={product.name}
            className="w-full aspect-square object-contain rounded-2xl"
          />
        ) : (
          <div className="w-full aspect-square bg-gray-100 rounded-2xl flex items-center justify-center text-gray-400">
            Intet billede
          </div>
        )}
      </div>

      {/* Info + button */}
      <div className="space-y-4">
        <div>
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
          <p className="text-gray-600 leading-relaxed">{product.description ?? ""}</p>
        </div>

        {inStock ? (
          <button
            onClick={handleAdd}
            className="w-full bg-primary hover:bg-primary-dark text-secondary font-bold py-3 px-6 rounded-xl transition"
          >
            {added ? "Lagt i kurv ✓" : "Læg i kurv"}
          </button>
        ) : (
          <button disabled className="w-full bg-gray-100 text-gray-400 font-bold py-3 px-6 rounded-xl cursor-not-allowed">
            Ikke på lager
          </button>
        )}
      </div>
    </div>
  );
}
