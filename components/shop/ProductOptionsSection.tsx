"use client";

import { useState, useMemo } from "react";
import { ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "./CartProvider";
import { formatPrice, withVat } from "@/lib/utils";
import type { Product, SKU, ProductOptionGroup, ProductOptionValue, GlobalColor, SKUOptionValue } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

type OptionValueFull = ProductOptionValue & {
  globalColor: GlobalColor | null;
  skuValues: SKUOptionValue[];
};

type OptionGroupFull = ProductOptionGroup & {
  values: OptionValueFull[];
};

type SkuFull = SKU & {
  optionValues: { optionValueId: string }[];
};

type Props = {
  product: Product;
  skus: SkuFull[];
  optionGroups: OptionGroupFull[];
  vatPct?: number;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ProductOptionsSection({ product, skus, optionGroups, vatPct = 25 }: Props) {
  const { addItem } = useCart();

  // For COLOR + SIZE groups: track selected value IDs
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  // For TEXT + CUSTOM + SELECT groups: track text inputs
  const [textInputs, setTextInputs] = useState<Record<string, string>>({});

  const colorGroup = optionGroups.find((g) => g.type === "COLOR");
  const sizeGroup = optionGroups.find((g) => g.type === "SIZE");
  const otherGroups = optionGroups.filter((g) => g.type !== "COLOR" && g.type !== "SIZE");

  // Resolve active images from selected color value
  const selectedColorValueId = colorGroup ? selectedOptions[colorGroup.id] : null;
  const selectedColorValue = colorGroup?.values.find((v) => v.id === selectedColorValueId);
  const activeImages = (selectedColorValue?.images ?? []).length > 0
    ? selectedColorValue!.images
    : product.images;

  // Resolve active SKU: find the SKU whose option values match all selected COLOR+SIZE values
  const activeSku = useMemo((): SkuFull | null => {
    const inventoryGroups = optionGroups.filter((g) => g.type === "COLOR" || g.type === "SIZE");
    const requiredValueIds = inventoryGroups
      .map((g) => selectedOptions[g.id])
      .filter(Boolean);

    if (requiredValueIds.length === 0) return null;
    if (requiredValueIds.length !== inventoryGroups.length) return null;

    return skus.find((sku) => {
      const skuValueIds = sku.optionValues.map((sv) => sv.optionValueId);
      return requiredValueIds.every((vid) => skuValueIds.includes(vid));
    }) ?? null;
  }, [skus, optionGroups, selectedOptions]);

  function selectOption(groupId: string, valueId: string) {
    setSelectedOptions((prev) => ({ ...prev, [groupId]: valueId }));
  }

  // Determine which size values are available (in stock) for the selected color
  function isSizeAvailable(sizeValue: OptionValueFull): boolean {
    const colorValueId = colorGroup ? selectedOptions[colorGroup.id] : null;
    if (!colorGroup || !colorValueId) {
      // No color selection needed — find SKU by size alone
      return skus.some((sku) => {
        const skuValueIds = sku.optionValues.map((sv) => sv.optionValueId);
        return skuValueIds.includes(sizeValue.id) && sku.stock > 0;
      });
    }
    // Find SKU for this color + size combination
    return skus.some((sku) => {
      const skuValueIds = sku.optionValues.map((sv) => sv.optionValueId);
      return skuValueIds.includes(colorValueId) && skuValueIds.includes(sizeValue.id) && sku.stock > 0;
    });
  }

  // Compute extra fee from TEXT/CUSTOM groups
  const extraFee = otherGroups.reduce((total, g) => {
    if ((g.type === "TEXT" || g.type === "CUSTOM") && g.fee && textInputs[g.id]) {
      return total + g.fee;
    }
    return total;
  }, 0);

  function handleAddToCart() {
    if (!activeSku && (colorGroup || sizeGroup)) {
      if (colorGroup && !selectedOptions[colorGroup.id]) {
        toast.error("Vælg venligst en farve");
        return;
      }
      if (sizeGroup && !selectedOptions[sizeGroup.id]) {
        toast.error("Vælg venligst en størrelse");
        return;
      }
      toast.error("Ugyldig kombination");
      return;
    }

    // Validate required other groups
    for (const g of otherGroups) {
      if (g.required && !textInputs[g.id]) {
        toast.error(`Udfyld venligst: ${g.label}`);
        return;
      }
    }

    if (activeSku && activeSku.stock === 0) {
      toast.error("Denne variant er udsolgt");
      return;
    }

    const colorName = selectedColorValue?.label;
    const sizeValueId = sizeGroup ? selectedOptions[sizeGroup.id] : null;
    const sizeValue = sizeGroup?.values.find((v) => v.id === sizeValueId);

    // Build optionSelections snapshot for non-inventory groups
    const optionSelections = otherGroups
      .filter((g) => textInputs[g.id])
      .map((g) => ({
        groupLabel: g.label,
        value: g.type === "SELECT"
          ? (textInputs[g.id] ?? "")
          : (textInputs[g.id] ?? ""),
      }));

    const skuToUse = activeSku ?? skus[0];
    if (!skuToUse) {
      toast.error("Produktet er ikke tilgængeligt");
      return;
    }

    addItem({
      skuId: skuToUse.id,
      productId: product.id,
      productName: product.name,
      size: sizeValue?.label ?? skuToUse.size,
      price: product.price,
      quantity: 1,
      image: activeImages[0],
      colorName: colorName || undefined,
      optionSelections: optionSelections.length > 0 ? optionSelections : undefined,
      customizationFee: extraFee > 0 ? extraFee : undefined,
      clubRoleRequired: product.clubRoleRequired ?? null,
    });

    const colorLabel = colorName ? ` · ${colorName}` : "";
    const sizeLabel = sizeValue?.label ?? skuToUse.size;
    toast.success(`${product.name} (${sizeLabel}${colorLabel}) lagt i kurven`);
  }

  return (
    <div className="grid md:grid-cols-2 gap-8">
      {/* Gallery */}
      <div>
        {activeImages.length > 0 ? (
          <div className="space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeImages[0]}
              alt={product.name}
              className="w-full aspect-square object-cover rounded-2xl"
            />
            {activeImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {activeImages.slice(1).map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={url}
                    alt=""
                    className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="w-full aspect-square bg-gray-100 rounded-2xl flex items-center justify-center text-gray-400">
            Intet billede
          </div>
        )}
      </div>

      {/* Options + add to cart */}
      <div className="space-y-5">
        {/* COLOR group */}
        {colorGroup && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">
              {colorGroup.label}
              {selectedColorValue && (
                <span className="ml-2 text-secondary font-bold">– {selectedColorValue.label}</span>
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              {colorGroup.values.map((v) => {
                const selected = selectedOptions[colorGroup.id] === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => selectOption(colorGroup.id, v.id)}
                    title={v.label}
                    className={`w-9 h-9 rounded-full border-2 transition ${
                      selected ? "border-secondary scale-110 shadow-md" : "border-gray-200 hover:border-gray-400"
                    }`}
                    style={{ background: v.globalColor?.hex ?? "#ccc" }}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* SIZE group */}
        {sizeGroup && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">
              {sizeGroup.label}
              {selectedOptions[sizeGroup.id] && (
                <span className="ml-2 text-secondary font-bold">
                  – {sizeGroup.values.find((v) => v.id === selectedOptions[sizeGroup.id])?.label}
                </span>
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              {sizeGroup.values.map((v) => {
                const available = isSizeAvailable(v);
                const selected = selectedOptions[sizeGroup.id] === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => available && selectOption(sizeGroup.id, v.id)}
                    disabled={!available}
                    className={`w-14 h-10 rounded-lg border text-sm font-medium transition ${
                      selected
                        ? "bg-secondary text-white border-secondary"
                        : !available
                          ? "border-gray-200 text-gray-300 cursor-not-allowed line-through"
                          : "border-gray-300 hover:border-secondary text-gray-800"
                    }`}
                  >
                    {v.label}
                  </button>
                );
              })}
            </div>
            {activeSku && activeSku.stock <= 3 && activeSku.stock > 0 && (
              <p className="text-orange-500 text-xs mt-2">Kun {activeSku.stock} tilbage!</p>
            )}
          </div>
        )}

        {/* Other groups (TEXT, SELECT, CUSTOM) */}
        {otherGroups.map((g) => (
          <div key={g.id} className="border rounded-xl p-4 bg-surface">
            <p className="text-sm font-medium text-gray-700 mb-2">
              {g.label}
              {g.fee && g.fee > 0 && (
                <span className="ml-2 text-gray-500 font-normal text-xs">
                  (+{formatPrice(withVat(g.fee, vatPct))})
                </span>
              )}
              {!g.required && <span className="ml-1 text-gray-400 font-normal text-xs">(valgfrit)</span>}
            </p>

            {g.type === "TEXT" && (
              <input
                type="text"
                value={textInputs[g.id] ?? ""}
                onChange={(e) => setTextInputs((prev) => ({ ...prev, [g.id]: e.target.value.toUpperCase().slice(0, 14) }))}
                placeholder="f.eks. JENSEN"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
              />
            )}

            {g.type === "SELECT" && (
              <div className="flex flex-wrap gap-2">
                {g.values.map((v) => {
                  const selected = textInputs[g.id] === v.label;
                  return (
                    <button key={v.id} type="button"
                      onClick={() => setTextInputs((prev) => ({ ...prev, [g.id]: selected ? "" : v.label }))}
                      className={`px-3 py-1.5 text-sm border rounded-lg transition ${
                        selected ? "bg-secondary text-white border-secondary" : "border-gray-300 hover:border-secondary"
                      }`}
                    >
                      {v.label}
                    </button>
                  );
                })}
              </div>
            )}

            {g.type === "CUSTOM" && (
              <input
                type={g.inputType ?? "text"}
                value={textInputs[g.id] ?? ""}
                onChange={(e) => setTextInputs((prev) => ({ ...prev, [g.id]: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
              />
            )}
          </div>
        ))}

        {/* Price summary */}
        {extraFee > 0 && (
          <p className="text-sm text-gray-500">
            Subtotal: <span className="font-bold text-gray-900">{formatPrice(withVat(product.price + extraFee, vatPct))}</span>
            <span className="ml-1 text-xs">inkl. moms (inkl. {formatPrice(withVat(extraFee, vatPct))} for tryk)</span>
          </p>
        )}

        {/* Add to cart */}
        <button
          type="button"
          onClick={handleAddToCart}
          className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-secondary font-bold py-3 px-6 rounded-xl transition"
        >
          <ShoppingCart size={20} />
          Læg i kurv
        </button>
      </div>
    </div>
  );
}
