"use client";

import { useState } from "react";
import { ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "./CartProvider";
import { formatPrice } from "@/lib/utils";
import type { Product, SKU } from "@prisma/client";

const SIZES_ORDER = [
  "XS","S","M","L","XL","XXL",
  "116","128","140","152","164",
];

export function AddToCartSection({
  product,
  skus,
}: {
  product: Product;
  skus: SKU[];
}) {
  const { addItem } = useCart();
  const [selectedSku, setSelectedSku] = useState<SKU | null>(null);
  const [withCustomization, setWithCustomization] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customNumber, setCustomNumber] = useState("");

  const sortedSkus = [...skus].sort(
    (a, b) => SIZES_ORDER.indexOf(a.size) - SIZES_ORDER.indexOf(b.size),
  );

  function handleAdd() {
    if (!selectedSku) {
      toast.error("Vælg venligst en størrelse");
      return;
    }
    if (selectedSku.stock === 0) {
      toast.error("Denne størrelse er udsolgt");
      return;
    }

    addItem({
      skuId: selectedSku.id,
      productId: product.id,
      productName: product.name,
      size: selectedSku.size,
      price: product.price,
      quantity: 1,
      image: product.images[0],
      customName: withCustomization ? customName || undefined : undefined,
      customNumber: withCustomization && product.customizationShowNumber ? customNumber || undefined : undefined,
      customizationFee: withCustomization && product.customizationFee != null
        ? product.customizationFee
        : undefined,
      clubRoleRequired: product.clubRoleRequired ?? null,
    });

    toast.success(`${product.name} (${selectedSku.size}) lagt i kurven`);
  }

  return (
    <div className="space-y-5">
      {/* Size selector */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">
          Størrelse{" "}
          {selectedSku && (
            <span className="font-bold text-secondary">
              – {selectedSku.size}
            </span>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          {sortedSkus.map((sku) => {
            const outOfStock = sku.stock === 0;
            const selected = selectedSku?.id === sku.id;
            return (
              <button
                key={sku.id}
                onClick={() => !outOfStock && setSelectedSku(sku)}
                disabled={outOfStock}
                className={`w-14 h-10 rounded-lg border text-sm font-medium transition ${
                  selected
                    ? "bg-secondary text-white border-secondary"
                    : outOfStock
                      ? "border-gray-200 text-gray-300 cursor-not-allowed line-through"
                      : "border-gray-300 hover:border-secondary text-gray-800"
                }`}
              >
                {sku.size}
              </button>
            );
          })}
        </div>
        {selectedSku && selectedSku.stock <= 3 && selectedSku.stock > 0 && (
          <p className="text-orange-500 text-xs mt-2">
            Kun {selectedSku.stock} tilbage på lager!
          </p>
        )}
      </div>

      {/* Optional jersey customization */}
      {product.customizationFee != null && (
        <div className="border rounded-xl p-4 bg-surface">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={withCustomization}
              onChange={(e) => setWithCustomization(e.target.checked)}
              className="w-4 h-4 accent-secondary"
            />
            <span className="text-sm font-medium">
              {product.customizationLabel ?? "Tilføj trøjetryk"}{" "}
              {product.customizationFee > 0 && (
                <span className="text-gray-500 font-normal">
                  (+{formatPrice(product.customizationFee)})
                </span>
              )}
            </span>
          </label>

          {withCustomization && (
            <div className={`mt-3 grid gap-3 ${product.customizationShowNumber ? "grid-cols-2" : "grid-cols-1"}`}>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">
                  Navn (valgfrit)
                </label>
                <input
                  value={customName}
                  onChange={(e) =>
                    setCustomName(e.target.value.toUpperCase().slice(0, 14))
                  }
                  placeholder="JENSEN"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
                />
              </div>
              {product.customizationShowNumber && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">
                    Nummer (valgfrit)
                  </label>
                  <input
                    value={customNumber}
                    onChange={(e) =>
                      setCustomNumber(e.target.value.replace(/\D/g, "").slice(0, 2))
                    }
                    placeholder="10"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Add to cart button */}
      <button
        onClick={handleAdd}
        className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-secondary font-bold py-3 px-6 rounded-xl transition"
      >
        <ShoppingCart size={20} />
        Læg i kurv
      </button>
    </div>
  );
}
