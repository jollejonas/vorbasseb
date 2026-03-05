"use client";

import { useState } from "react";
import { useCart } from "./CartProvider";
import type { Product, SKU } from "@prisma/client";

export function SimpleAddToCart({
  product,
  skus,
}: {
  product: Pick<Product, "id" | "name" | "price" | "clubRoleRequired" | "images">;
  skus: SKU[];
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

  if (!inStock) {
    return (
      <button disabled className="w-full bg-gray-100 text-gray-400 font-bold py-3 px-6 rounded-xl cursor-not-allowed">
        Ikke på lager
      </button>
    );
  }

  return (
    <button
      onClick={handleAdd}
      className="w-full bg-primary hover:bg-primary-dark text-secondary font-bold py-3 px-6 rounded-xl transition"
    >
      {added ? "Lagt i kurv ✓" : "Læg i kurv"}
    </button>
  );
}
