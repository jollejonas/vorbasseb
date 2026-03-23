"use client";

import { useState } from "react";
import { ProductImageGallery } from "./ProductImageGallery";
import { AddToCartSection } from "./AddToCartSection";
import { formatPrice, withVat } from "@/lib/utils";
import { getEffectivePrice } from "@/lib/pricing";
import type { Product, SKU, ColorVariant } from "@prisma/client";

type ColorVariantWithSkus = ColorVariant & { skus: SKU[] };

type Props = {
  product: Product;
  skus: SKU[]; // global skus (no color variant)
  colorVariants: ColorVariantWithSkus[];
  vatPct: number;
};

export function ProductColorSection({ product, skus, colorVariants, vatPct }: Props) {
  const [selectedColorIdx, setSelectedColorIdx] = useState(0);
  const { effectivePrice, isOnSale } = getEffectivePrice(product.price, product.salePrice, product.salePriceStart, product.salePriceEnd);

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
        <div className="mb-4">
          {product.membersOnly && (
            <span className="inline-block bg-secondary text-white text-xs font-semibold px-3 py-1 rounded-full mb-3">
              Kun for fanklubsmedlemmer
            </span>
          )}
          <h1 className="text-2xl font-bold mb-1">{product.name}</h1>
          {isOnSale ? (
            <p className="text-xl mb-2">
              <span className="line-through text-gray-400 mr-2">{formatPrice(withVat(product.price, vatPct))}</span>
              <span className="font-bold text-red-600">{formatPrice(withVat(effectivePrice, vatPct))}</span>
              <span className="text-sm text-gray-400 font-normal ml-1">inkl. moms</span>
            </p>
          ) : (
            <p className="text-xl font-bold text-secondary mb-2">
              {formatPrice(withVat(product.price, vatPct))}
              <span className="text-sm text-gray-400 font-normal ml-1">inkl. moms</span>
            </p>
          )}
          <p className="text-gray-600 leading-relaxed mb-4">{product.description}</p>
        </div>
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
