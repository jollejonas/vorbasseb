"use client";

import { useState } from "react";
import { ProductImageGallery } from "./ProductImageGallery";
import { AddToCartSection } from "./AddToCartSection";
import type { Product, SKU, ColorVariant } from "@prisma/client";

type ColorVariantWithSkus = ColorVariant & { skus: SKU[] };

type Props = {
  product: Product;
  skus: SKU[]; // global skus (no color variant)
  colorVariants: ColorVariantWithSkus[];
};

export function ProductColorSection({ product, skus, colorVariants }: Props) {
  const [selectedColorIdx, setSelectedColorIdx] = useState(0);

  const hasColors = colorVariants.length > 0;
  const selectedColor = hasColors ? colorVariants[selectedColorIdx] : null;

  const activeImages =
    selectedColor && selectedColor.images.length > 0
      ? selectedColor.images
      : product.images;

  const activeSkus = selectedColor ? selectedColor.skus : skus;

  return (
    <div className="grid md:grid-cols-2 gap-10">
      {/* Image gallery — key forces reset on color switch */}
      <ProductImageGallery
        key={selectedColor?.id ?? "default"}
        images={activeImages}
        name={product.name}
      />

      {/* Info + color swatches + add to cart */}
      <div>
        {hasColors && (
          <div className="mb-5">
            <p className="text-sm font-medium text-gray-700 mb-2">
              Farve{" "}
              {selectedColor && (
                <span className="font-bold text-secondary">
                  – {selectedColor.name}
                </span>
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              {colorVariants.map((cv, i) => (
                <button
                  key={cv.id}
                  onClick={() => setSelectedColorIdx(i)}
                  title={cv.name}
                  className={`w-9 h-9 rounded-full border-2 transition ${
                    i === selectedColorIdx
                      ? "border-secondary ring-2 ring-secondary ring-offset-1"
                      : "border-gray-300 hover:border-gray-500"
                  }`}
                  style={{ backgroundColor: cv.hex }}
                  aria-label={cv.name}
                  aria-pressed={i === selectedColorIdx}
                />
              ))}
            </div>
          </div>
        )}

        <AddToCartSection
          product={product}
          skus={activeSkus}
          colorName={selectedColor?.name}
        />
      </div>
    </div>
  );
}
