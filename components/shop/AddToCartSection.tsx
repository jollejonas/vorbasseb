"use client";

import { useState } from "react";
import { ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "./CartProvider";
import { GroupOrderConfirmDialog } from "./GroupOrderConfirmDialog";
import { getEffectivePrice } from "@/lib/pricing";
import type { Product, SKU } from "@prisma/client";

const SIZES_ORDER = [
  "XS","S","M","L","XL","XXL",
  "116","128","140","152","164",
];

export function AddToCartSection({
  product,
  skus,
  colorName,
  image,
}: {
  product: Product;
  skus: SKU[];
  colorName?: string;
  image?: string;
}) {
  const { addItem } = useCart();
  const [selectedSku, setSelectedSku] = useState<SKU | null>(null);
  const [showGroupOrderDialog, setShowGroupOrderDialog] = useState(false);
  const { effectivePrice, isOnSale } = getEffectivePrice(product.price, product.salePrice, product.salePriceStart, product.salePriceEnd);

  const sortedSkus = [...skus].sort(
    (a, b) => SIZES_ORDER.indexOf(a.size) - SIZES_ORDER.indexOf(b.size),
  );

  function doAddToCart() {
    if (!selectedSku) return;
    addItem({
      skuId: selectedSku.id,
      productId: product.id,
      productName: product.name,
      size: selectedSku.size,
      price: effectivePrice,
      quantity: 1,
      image: image ?? product.images[0],
      clubRoleRequired: product.clubRoleRequired ?? null,
      colorName: colorName || undefined,
      isOnSale,
      isGroupOrder: product.isGroupOrder,
      groupOrderDeadline: product.groupOrderDeadline ? product.groupOrderDeadline.toISOString() : null,
    });

    const colorLabel = colorName ? ` · ${colorName}` : "";
    toast.success(`${product.name} (${selectedSku.size}${colorLabel}) lagt i kurven`);
  }

  function handleAdd() {
    if (!selectedSku) {
      toast.error("Vælg venligst en størrelse");
      return;
    }
    if (selectedSku.stock === 0) {
      toast.error("Denne størrelse er udsolgt");
      return;
    }
    if (product.isGroupOrder) {
      setShowGroupOrderDialog(true);
      return;
    }
    doAddToCart();
  }

  return (
    <>
    <GroupOrderConfirmDialog
      open={showGroupOrderDialog}
      deadline={product.groupOrderDeadline ? product.groupOrderDeadline.toISOString() : null}
      onConfirm={() => { setShowGroupOrderDialog(false); doAddToCart(); }}
      onCancel={() => setShowGroupOrderDialog(false)}
    />
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

      {/* Add to cart button */}
      <button
        onClick={handleAdd}
        className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-secondary font-bold py-3 px-6 rounded-xl transition"
      >
        <ShoppingCart size={20} />
        Læg i kurv
      </button>
    </div>
    </>
  );
}
