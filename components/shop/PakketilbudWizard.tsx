"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { Check, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useCart, type PrintElement } from "./CartProvider";
import { JerseyDesignerCanvas, JerseyDesignerControls } from "./JerseyDesignerPanel";
import { PrintConfirmDialog } from "./PrintConfirmDialog";
import { formatPrice, withVat } from "@/lib/utils";
import { getEffectivePrice } from "@/lib/pricing";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import { applyDesignerZonePlacements } from "@/lib/designerZonePlacements";
import type {
  Product,
  SKU,
  ColorVariant,
  ProductOptionGroup,
  ProductOptionValue,
  GlobalColor,
  SKUOptionValue,
  DesignerZone,
  DesignerLogo,
} from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

type OptionValueFull = ProductOptionValue & {
  globalColor: GlobalColor | null;
  skuValues?: SKUOptionValue[];
};
type OptionGroupFull = ProductOptionGroup & { values: OptionValueFull[] };
type SkuWithOptions = SKU & { optionValues: { optionValueId: string }[] };
type ColorVariantWithSkus = ColorVariant & { skus: SKU[] };

type ZoneWithFixedLogo = DesignerZone & { fixedLogo: DesignerLogo | null };
type ProductFull = Product & {
  optionGroups: OptionGroupFull[];
  skus: SkuWithOptions[];
  colorVariants: ColorVariantWithSkus[];
  designerZones: ZoneWithFixedLogo[];
};

type PakketilbudItemData = {
  id: string;
  productId: string;
  label: string | null;
  position: number;
  product: ProductFull;
};

type PakketilbudData = {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  salePrice?: number | null;
  salePriceStart?: Date | string | null;
  salePriceEnd?: Date | string | null;
  images: string[];
  items: PakketilbudItemData[];
};

type StepState = {
  // New option groups mode
  selectedOptions: Record<string, string>; // groupId → valueId
  textInputs: Record<string, string>; // groupId → text
  // Legacy colorVariants mode
  selectedColorVariantId: string | null;
  selectedLegacySkuId: string | null;
  // Legacy customization (name/number print)
  withCustomization: boolean;
  customName: string;
  customNumber: string;
  // Jersey designer print elements
  printElements: PrintElement[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveSkuFromOptions(
  skus: SkuWithOptions[],
  selectedOptions: Record<string, string>,
  optionGroups: OptionGroupFull[],
): SkuWithOptions | null {
  const inventoryGroups = optionGroups.filter((g) => g.type === "COLOR" || g.type === "SIZE");
  const requiredValueIds = inventoryGroups.map((g) => selectedOptions[g.id]).filter(Boolean);
  if (requiredValueIds.length === 0) return null;
  if (requiredValueIds.length !== inventoryGroups.length) return null;
  return (
    skus.find((sku) => {
      const skuValueIds = sku.optionValues.map((sv) => sv.optionValueId);
      return requiredValueIds.every((vid) => skuValueIds.includes(vid));
    }) ?? null
  );
}

function isSizeAvailableForOptions(
  skus: SkuWithOptions[],
  sizeValue: OptionValueFull,
  colorGroup: OptionGroupFull | undefined,
  selectedOptions: Record<string, string>,
): boolean {
  const colorValueId = colorGroup ? selectedOptions[colorGroup.id] : null;
  if (!colorGroup || !colorValueId) {
    return skus.some((sku) => {
      const ids = sku.optionValues.map((sv) => sv.optionValueId);
      return ids.includes(sizeValue.id) && sku.stock > 0;
    });
  }
  return skus.some((sku) => {
    const ids = sku.optionValues.map((sv) => sv.optionValueId);
    return ids.includes(colorValueId) && ids.includes(sizeValue.id) && sku.stock > 0;
  });
}

function resolveImageByIndex(images: string[] | undefined, idx: number | null | undefined): string | null {
  if (idx == null) return null;
  return images?.[idx] ?? null;
}

function normalizeHex(hex: string | null | undefined): string {
  if (!hex) return "";
  const v = hex.trim().toLowerCase();
  return v.startsWith("#") ? v : `#${v}`;
}

function toValidHex(value: string | null | undefined): string | null {
  const normalized = normalizeHex(value);
  if (!normalized) return null;
  const clean = normalized.slice(1);
  return /^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(clean) ? normalized : null;
}

function normalizeLabel(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

const COLOR_ALIAS_MAP: Record<string, string> = {
  sort: "black",
  black: "black",
  hvid: "white",
  white: "white",
  gra: "gray",
  graa: "gray",
  gray: "gray",
  grey: "gray",
  rod: "red",
  roed: "red",
  red: "red",
  bla: "blue",
  blaa: "blue",
  blue: "blue",
  navy: "navy",
  marine: "navy",
  gron: "green",
  groen: "green",
  green: "green",
  gul: "yellow",
  yellow: "yellow",
  orange: "orange",
  lilla: "purple",
  purple: "purple",
  pink: "pink",
  brun: "brown",
  brown: "brown",
};

function normalizeToken(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function tokenizeColorLabel(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[^A-Za-z0-9]+/)
    .map(normalizeToken)
    .filter(Boolean);
}

function canonicalColorTokens(value: string | null | undefined): string[] {
  const tokens = tokenizeColorLabel(value).map((token) => COLOR_ALIAS_MAP[token] ?? token);
  return [...new Set(tokens)];
}

function uniqueNormalizedLabels(values: Array<string | null | undefined>): string[] {
  const labels = values.map(normalizeLabel).filter(Boolean);
  return [...new Set(labels)];
}

function getVariantSearchLabels(variant: ColorVariantWithSkus): string[] {
  const labels = [variant.name];
  // Legacy imports sometimes stored color names in the hex field.
  if (!toValidHex(variant.hex)) labels.push(variant.hex);
  return uniqueNormalizedLabels(labels);
}

type RGB = { r: number; g: number; b: number };

function parseHexColor(hex: string | null | undefined): RGB | null {
  const normalized = toValidHex(hex);
  if (!normalized) return null;
  const clean = normalized.slice(1);

  const expanded = clean.length === 3
    ? clean.split("").map((ch) => `${ch}${ch}`).join("")
    : clean;
  const numeric = Number.parseInt(expanded, 16);
  if (Number.isNaN(numeric)) return null;

  return {
    r: (numeric >> 16) & 0xff,
    g: (numeric >> 8) & 0xff,
    b: numeric & 0xff,
  };
}

function colorDistanceSq(a: RGB, b: RGB): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

function resolveOptionColorFallbackImages(
  selectedColorValue: OptionValueFull | undefined,
  colorValues: OptionValueFull[],
  colorVariants: ColorVariantWithSkus[],
  skus: SkuWithOptions[],
  selectedSizeValueId: string | undefined,
): string[] {
  if (!selectedColorValue) return [];
  const selectedColor = selectedColorValue;

  const variantsWithImages = colorVariants.filter((cv) => cv.images.length > 0);
  if (variantsWithImages.length === 0) return [];

  const selectedColorPosition = colorValues.find((value) => value.id === selectedColor.id)?.position ?? null;
  const selectedHex = toValidHex(selectedColor.globalColor?.hex);
  const selectedLabels = uniqueNormalizedLabels([
    selectedColor.label,
    selectedColor.globalColor?.name,
  ]);

  function rankedLinkedVariants(requireSelectedSize: boolean) {
    const linkedVariantCounts = new Map<string, number>();
    for (const sku of skus) {
      if (!sku.colorVariantId) continue;
      if (!sku.optionValues.some((ov) => ov.optionValueId === selectedColor.id)) continue;
      if (
        requireSelectedSize &&
        selectedSizeValueId &&
        !sku.optionValues.some((ov) => ov.optionValueId === selectedSizeValueId)
      ) {
        continue;
      }
      linkedVariantCounts.set(sku.colorVariantId, (linkedVariantCounts.get(sku.colorVariantId) ?? 0) + 1);
    }
    return [...linkedVariantCounts.entries()]
      .map(([variantId, count]) => ({
        count,
        variant: variantsWithImages.find((cv) => cv.id === variantId) ?? null,
      }))
      .filter((entry): entry is { count: number; variant: ColorVariantWithSkus } => entry.variant !== null)
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.variant.position - b.variant.position;
      });
  }

  function resolveFromRankedVariants(ranked: Array<{ count: number; variant: ColorVariantWithSkus }>): string[] | null {
    if (ranked.length === 0) return null;

    const bestCount = ranked[0].count;
    const topRanked = ranked.filter((entry) => entry.count === bestCount);
    if (topRanked.length === 1) return topRanked[0].variant.images;

    if (selectedColorPosition !== null) {
      const rankedByPosition = [...topRanked]
        .map((entry) => ({
          entry,
          distance: Math.abs(entry.variant.position - selectedColorPosition),
        }))
        .sort((a, b) => a.distance - b.distance);
      const best = rankedByPosition[0];
      const runnerUp = rankedByPosition[1];
      if (!runnerUp || best.distance !== runnerUp.distance) {
        return best.entry.variant.images;
      }
    }

    return null;
  }

  const bySelectedSizeSkuLink = selectedSizeValueId
    ? resolveFromRankedVariants(rankedLinkedVariants(true))
    : null;
  if (bySelectedSizeSkuLink) return bySelectedSizeSkuLink;

  if (selectedHex) {
    const byHex = variantsWithImages.filter((cv) => toValidHex(cv.hex) === selectedHex);
    if (byHex.length === 1) return byHex[0].images;
  }

  if (selectedLabels.length > 0) {
    const byName = variantsWithImages.filter((cv) => {
      const variantLabels = getVariantSearchLabels(cv);
      return selectedLabels.some((label) => variantLabels.includes(label));
    });
    if (byName.length === 1) return byName[0].images;
  }

  const bySkuLink = resolveFromRankedVariants(rankedLinkedVariants(false));
  if (bySkuLink) return bySkuLink;

  const selectedCanonicalTokens = [
    ...new Set(selectedLabels.flatMap((label) => canonicalColorTokens(label))),
  ];
  if (selectedCanonicalTokens.length > 0) {
    const rankedByCanonicalName = variantsWithImages
      .map((cv) => {
        const variantTokens = new Set(getVariantSearchLabels(cv).flatMap((label) => canonicalColorTokens(label)));
        const overlapScore = selectedCanonicalTokens.reduce(
          (score, token) => (variantTokens.has(token) ? score + 1 : score),
          0,
        );
        return { overlapScore, variant: cv };
      })
      .filter((entry) => entry.overlapScore > 0)
      .sort((a, b) => b.overlapScore - a.overlapScore);

    if (rankedByCanonicalName.length > 0) {
      const hasTie =
        rankedByCanonicalName.length > 1 &&
        rankedByCanonicalName[0].overlapScore === rankedByCanonicalName[1].overlapScore;
      if (!hasTie) return rankedByCanonicalName[0].variant.images;
    }
  }

  const selectedRgb = parseHexColor(selectedColor.globalColor?.hex);
  if (selectedRgb) {
    const rankedByHexDistance = variantsWithImages
      .map((cv) => {
        const variantRgb = parseHexColor(cv.hex);
        return variantRgb
          ? { distanceSq: colorDistanceSq(selectedRgb, variantRgb), variant: cv }
          : null;
      })
      .filter((entry): entry is { distanceSq: number; variant: ColorVariantWithSkus } => entry !== null)
      .sort((a, b) => a.distanceSq - b.distanceSq);

    if (rankedByHexDistance.length > 0) {
      const closest = rankedByHexDistance[0];
      const runnerUp = rankedByHexDistance[1];
      const maxDistanceSq = 85 * 85;
      const minLeadSq = 12 * 12;
      const clearlyBest = !runnerUp || (runnerUp.distanceSq - closest.distanceSq) >= minLeadSq;

      if (closest.distanceSq <= maxDistanceSq && clearlyBest) {
        return closest.variant.images;
      }
    }
  }

  if (selectedColorPosition !== null) {
    const rankedByPositionDistance = variantsWithImages
      .map((cv) => ({
        distance: Math.abs(cv.position - selectedColorPosition),
        variant: cv,
      }))
      .sort((a, b) => a.distance - b.distance);
    if (rankedByPositionDistance.length > 0) {
      const best = rankedByPositionDistance[0];
      const runnerUp = rankedByPositionDistance[1];
      if (!runnerUp || best.distance !== runnerUp.distance) {
        return best.variant.images;
      }
    }
  }

  return [];
}

function resolveOptionColorProductImageFallback(
  selectedColorValue: OptionValueFull | undefined,
  colorValues: OptionValueFull[],
  productImages: string[],
): string[] {
  if (!selectedColorValue || productImages.length === 0 || colorValues.length === 0) return [];

  const selectedIdx = colorValues.findIndex((value) => value.id === selectedColorValue.id);
  if (selectedIdx < 0) return [];

  // One image per color, ordered by color position.
  if (productImages.length === colorValues.length) {
    return productImages[selectedIdx] ? [productImages[selectedIdx]] : [];
  }

  // N images per color (e.g. front/back), grouped in color order.
  if (productImages.length % colorValues.length === 0) {
    const imagesPerColor = productImages.length / colorValues.length;
    const start = selectedIdx * imagesPerColor;
    return productImages.slice(start, start + imagesPerColor).filter(Boolean);
  }

  return [];
}

function initialStep(product: ProductFull): StepState {
  const selectedOptions: Record<string, string> = {};
  const colorGroup = product.optionGroups.find((g) => g.type === "COLOR");
  if (colorGroup) {
    const firstInStock = colorGroup.values.find((v) =>
      product.skus.some((sku) =>
        sku.optionValues.some((ov) => ov.optionValueId === v.id) && sku.stock > 0
      )
    );
    if (firstInStock) selectedOptions[colorGroup.id] = firstInStock.id;
  }
  // Legacy: pre-select first color variant with stock
  const firstLegacyCv = product.colorVariants.find((cv) => cv.skus.some((s) => s.stock > 0)) ?? null;
  return {
    selectedOptions,
    textInputs: {},
    selectedColorVariantId: firstLegacyCv?.id ?? null,
    selectedLegacySkuId: null,
    withCustomization: false,
    customName: "",
    customNumber: "",
    printElements: [],
  };
}

function isStepComplete(
  state: StepState,
  product: ProductFull,
): boolean {
  const hasOptionGroups = product.optionGroups.length > 0;
  if (hasOptionGroups) {
    const colorGroup = product.optionGroups.find((g) => g.type === "COLOR");
    const sizeGroup = product.optionGroups.find((g) => g.type === "SIZE");
    if (colorGroup && !state.selectedOptions[colorGroup.id]) return false;
    if (sizeGroup && !state.selectedOptions[sizeGroup.id]) return false;
    // Required text groups
    for (const g of product.optionGroups) {
      if (g.required && (g.type === "TEXT" || g.type === "CUSTOM" || g.type === "SELECT")) {
        if (!state.textInputs[g.id]) return false;
      }
    }
    const sku = resolveSkuFromOptions(product.skus, state.selectedOptions, product.optionGroups);
    return sku !== null && sku.stock > 0;
  } else {
    // Legacy color variants mode
    if (product.colorVariants.length > 0) {
      if (!state.selectedColorVariantId) return false;
      if (!state.selectedLegacySkuId) return false;
    } else {
      if (product.skus.length > 0 && !state.selectedLegacySkuId) return false;
    }
    return true;
  }
}

// ─── Step component ────────────────────────────────────────────────────────────

function ItemStep({
  item,
  stepState,
  onChange,
  vatPct,
  logos,
  stepIndex,
  onAddTextChange,
  onDesignerOpenChange,
}: {
  item: PakketilbudItemData;
  stepState: StepState;
  onChange: (patch: Partial<StepState>) => void;
  vatPct: number;
  logos: DesignerLogo[];
  stepIndex: number;
  onAddTextChange?: (text: string) => void;
  onDesignerOpenChange?: (open: boolean) => void;
}) {
  const { product } = item;
  const hasOptionGroups = product.optionGroups.length > 0;
  const hasDesigner = product.designerEnabled && product.designerZones.length > 0;

  // ── Designer local ephemeral state ────────────────────────────────────────
  const [designerOpen, setDesignerOpen] = useState(false);
  const [previewSide, setPreviewSide] = useState<"front" | "back">("front");
  const [clickedZoneId, setClickedZoneId] = useState<number | null>(null);
  const [addType, setAddType] = useState<"text" | "logo">("text");
  const [addText, setAddText] = useState("");
  const [addLogoId, setAddLogoId] = useState<number | null>(null);
  const [addFontSize, setAddFontSize] = useState<"small" | "medium" | "large">("medium");
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Reset local/passed designer state when navigating between pakketilbud steps.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setDesignerOpen(false);
    setClickedZoneId(null);
    setAddText("");
    setAddLogoId(null);
    onDesignerOpenChange?.(false);
    onAddTextChange?.("");
  }, [stepIndex, onAddTextChange, onDesignerOpenChange]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function handleAddTextChange(val: string) {
    setAddText(val);
    onAddTextChange?.(val);
  }
  function handleDesignerOpenChange(val: boolean) {
    setDesignerOpen(val);
    onDesignerOpenChange?.(val);
    if (!val) onAddTextChange?.("");
  }
  function withTextConfirm(action: () => void) {
    if (designerOpen && clickedZoneId !== null && addText.trim().length > 0) {
      setPendingAction(() => action);
    } else {
      action();
    }
  }

  const zoneMap = useMemo(() => {
    const m = new Map<number, ZoneWithFixedLogo>();
    product.designerZones.forEach((z) => m.set(z.id, z));
    return m;
  }, [product.designerZones]);

  const clickedZone = clickedZoneId !== null ? (zoneMap.get(clickedZoneId) ?? null) : null;

  const handleZoneClick = useCallback((zone: DesignerZone) => {
    setClickedZoneId(zone.id);
    if (zone.allowText && !zone.allowLogo) setAddType("text");
    else if (!zone.allowText && zone.allowLogo) setAddType("logo");
    else setAddType("text");
    setAddText("");
    onAddTextChange?.("");
    setAddLogoId(null);
    setAddFontSize("medium");
    setPreviewSide(zone.side as "front" | "back");
  }, [onAddTextChange]);

  const handleConfirmAdd = useCallback(() => {
    if (!clickedZone) return;
    const logo =
      addType === "logo" && addLogoId !== null ? logos.find((l) => l.id === addLogoId) : undefined;
    if (addType === "text" && !addText.trim()) return;
    if (addType === "logo" && !logo) return;

    onChange({
      printElements: [
        ...stepState.printElements,
        {
          side: clickedZone.side as "front" | "back",
          zoneId: clickedZone.id,
          zoneLabel: clickedZone.label,
          position: clickedZone.position,
          type: addType,
          value: addType === "text" ? addText.trim() : String(addLogoId),
          logoUrl: logo?.imageUrl,
          fontSize: addFontSize,
        },
      ],
    });

    setToastMsg(`Tryk tilføjet til ${clickedZone.label}`);
    setClickedZoneId(null);
    setAddText("");
    onAddTextChange?.("");
    setAddLogoId(null);
    setTimeout(() => setToastMsg(null), 2500);
  }, [clickedZone, addType, addText, addLogoId, addFontSize, logos, stepState.printElements, onChange, onAddTextChange]);

  // ── Option groups ─────────────────────────────────────────────────────────
  const colorGroup = product.optionGroups.find((g) => g.type === "COLOR");
  const sizeGroup = product.optionGroups.find((g) => g.type === "SIZE");
  const otherGroups = product.optionGroups.filter(
    (g) => g.type !== "COLOR" && g.type !== "SIZE",
  );

  const selectedColorValueId = colorGroup ? stepState.selectedOptions[colorGroup.id] : undefined;
  const selectedSizeValueId = sizeGroup ? stepState.selectedOptions[sizeGroup.id] : undefined;
  const selectedColorValue = colorGroup?.values.find((v) => v.id === selectedColorValueId);
  const effectiveDesignerZones = applyDesignerZonePlacements(
    product.designerZones,
    selectedColorValue?.designerZonePlacements
  );
  const explicitOptionColorImages = selectedColorValue?.images ?? [];
  const legacyVariantColorImages = resolveOptionColorFallbackImages(
    selectedColorValue,
    colorGroup?.values ?? [],
    product.colorVariants,
    product.skus,
    selectedSizeValueId,
  );
  const positionalProductColorImages = resolveOptionColorProductImageFallback(
    selectedColorValue,
    colorGroup?.values ?? [],
    product.images,
  );
  const optionColorImages = explicitOptionColorImages.length > 0
    ? explicitOptionColorImages
    : legacyVariantColorImages.length > 0
      ? legacyVariantColorImages
      : positionalProductColorImages;
  const activeImages = hasOptionGroups
    ? optionColorImages.length > 0
      ? optionColorImages
      : product.images
    : product.images;

  // Color-aware designer fields — mirrors JerseyDesignerSection logic
  const productFrontImage =
    resolveImageByIndex(product.images, product.designerFrontImageIdx) ??
    product.images[0] ??
    null;
  const productBackImage = resolveImageByIndex(product.images, product.designerBackImageIdx);
  const colorFrontImage = resolveImageByIndex(
    optionColorImages,
    selectedColorValue?.designerFrontImageIdx,
  );
  const colorBackImage = resolveImageByIndex(
    optionColorImages,
    selectedColorValue?.designerBackImageIdx,
  );
  const resolvedFrontImage = colorFrontImage ?? productFrontImage;
  const resolvedBackImage = colorBackImage ?? productBackImage;
  const designerImages = [
    resolvedFrontImage,
    ...(resolvedBackImage && resolvedBackImage !== resolvedFrontImage ? [resolvedBackImage] : []),
  ].filter((img): img is string => img !== null);

  const colorAwareProduct = {
    ...product,
    images: designerImages.length > 0 ? designerImages : product.images,
    designerFrontImageIdx: resolvedFrontImage ? 0 : null,
    designerBackImageIdx: resolvedBackImage
      ? (resolvedBackImage === resolvedFrontImage ? 0 : 1)
      : null,
    designerPrintColor: selectedColorValue?.designerPrintColor ?? product.designerPrintColor,
  };
  const designerAvailableForSelection =
    hasDesigner &&
    colorAwareProduct.designerFrontImageIdx !== null &&
    !!colorAwareProduct.images[colorAwareProduct.designerFrontImageIdx];
  const hasBackDesignerImage =
    colorAwareProduct.designerBackImageIdx !== null &&
    !!colorAwareProduct.images[colorAwareProduct.designerBackImageIdx];
  const effectivePreviewSide = hasBackDesignerImage ? previewSide : "front";

  // ── Legacy color variants ─────────────────────────────────────────────────
  const selectedColorVariant = product.colorVariants.find(
    (cv) => cv.id === stepState.selectedColorVariantId,
  );
  const legacyImages =
    selectedColorVariant && selectedColorVariant.images.length > 0
      ? selectedColorVariant.images
      : product.images;

  const displayImages = hasOptionGroups ? activeImages : legacyImages;

  const legacySkus =
    product.colorVariants.length > 0
      ? selectedColorVariant?.skus ?? []
      : product.skus;

  const optionGroupFee = otherGroups.reduce((total, g) => {
    if ((g.type === "TEXT" || g.type === "CUSTOM") && g.fee && stepState.textInputs[g.id]) {
      return total + g.fee;
    }
    return total;
  }, 0);

  // ── Shared options JSX (always visible in right column) ───────────────────
  const optionsJsx = (
    <div className="space-y-3">
      <div>
        <h3 className="text-lg font-bold mb-0">{item.label ?? product.name}</h3>
        {item.label && item.label !== product.name && (
          <p className="text-sm text-gray-500 mb-1">{product.name}</p>
        )}
        {product.description && (
          <div className={`grid transition-all duration-300 ${designerOpen ? "grid-rows-[0fr]" : "grid-rows-[1fr]"}`}>
            <div className="overflow-hidden">
              <div className="product-content" dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.description) }} />
            </div>
          </div>
        )}
        {optionGroupFee > 0 && (
          <p className="text-sm text-gray-500 mt-1">
            + {formatPrice(withVat(optionGroupFee, vatPct))} for tryk
          </p>
        )}
      </div>

      {hasOptionGroups ? (
        <>
          {/* COLOR group */}
          {colorGroup && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">
                {colorGroup.label}
                {selectedColorValue && (
                  <span className="ml-2 text-secondary font-bold">– {selectedColorValue.label}</span>
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                {colorGroup.values.map((v) => {
                  const selected = stepState.selectedOptions[colorGroup.id] === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() =>
                        withTextConfirm(() => {
                          const nextSelectedOptions = {
                            ...stepState.selectedOptions,
                            [colorGroup.id]: v.id,
                          };
                          if (sizeGroup) {
                            const currentSizeId = stepState.selectedOptions[sizeGroup.id];
                            const currentSizeValue = sizeGroup.values.find((sv) => sv.id === currentSizeId);
                            const currentSizeStillAvailable = currentSizeValue
                              ? isSizeAvailableForOptions(
                                product.skus,
                                currentSizeValue,
                                colorGroup,
                                nextSelectedOptions,
                              )
                              : false;
                            if (!currentSizeStillAvailable) {
                              const firstAvailableSize = sizeGroup.values.find((sv) =>
                                isSizeAvailableForOptions(
                                  product.skus,
                                  sv,
                                  colorGroup,
                                  nextSelectedOptions,
                                )
                              );
                              if (firstAvailableSize) nextSelectedOptions[sizeGroup.id] = firstAvailableSize.id;
                              else delete nextSelectedOptions[sizeGroup.id];
                            }
                          }
                          onChange({
                            selectedOptions: nextSelectedOptions,
                          });
                          const nextColorFrontImage = resolveImageByIndex(v.images, v.designerFrontImageIdx);
                          const nextResolvedFrontImage = nextColorFrontImage ?? productFrontImage;
                          const nextDesignerAvailable = hasDesigner && nextResolvedFrontImage !== null;
                          if (!nextDesignerAvailable && designerOpen) {
                            handleDesignerOpenChange(false);
                            setClickedZoneId(null);
                            setPreviewSide("front");
                          }
                        })
                      }
                      title={v.label}
                      className={`w-8 h-8 rounded-full border-2 transition ${
                        selected
                          ? "border-secondary scale-110 shadow-md"
                          : "border-gray-200 hover:border-gray-400"
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
              <p className="text-sm font-medium text-gray-700 mb-1">
                {sizeGroup.label}
                {stepState.selectedOptions[sizeGroup.id] && (
                  <span className="ml-2 text-secondary font-bold">
                    – {sizeGroup.values.find((v) => v.id === stepState.selectedOptions[sizeGroup.id])?.label}
                  </span>
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                {sizeGroup.values.map((v) => {
                  const available = isSizeAvailableForOptions(
                    product.skus,
                    v,
                    colorGroup,
                    stepState.selectedOptions,
                  );
                  const selected = stepState.selectedOptions[sizeGroup.id] === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() =>
                        available &&
                        withTextConfirm(() =>
                          onChange({
                            selectedOptions: { ...stepState.selectedOptions, [sizeGroup.id]: v.id },
                          })
                        )
                      }
                      disabled={!available}
                      className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition ${
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
            </div>
          )}

          {/* Other groups */}
          {otherGroups.map((g) => (
            <div key={g.id} className="border rounded-xl p-4 bg-gray-50">
              <p className="text-sm font-medium text-gray-700 mb-1">
                {g.label}
                {g.fee && g.fee > 0 && (
                  <span className="ml-2 text-gray-500 font-normal text-xs">
                    (+{formatPrice(withVat(g.fee, vatPct))})
                  </span>
                )}
                {!g.required && (
                  <span className="ml-1 text-gray-400 font-normal text-xs">(valgfrit)</span>
                )}
              </p>
              {g.type === "SELECT" ? (
                <select
                  value={stepState.textInputs[g.id] ?? ""}
                  onChange={(e) =>
                    onChange({ textInputs: { ...stepState.textInputs, [g.id]: e.target.value } })
                  }
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Vælg...</option>
                  {g.values.map((v) => (
                    <option key={v.id} value={v.label}>
                      {v.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={stepState.textInputs[g.id] ?? ""}
                  onChange={(e) =>
                    onChange({ textInputs: { ...stepState.textInputs, [g.id]: e.target.value } })
                  }
                  placeholder={g.label}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              )}
            </div>
          ))}
        </>
      ) : (
        <>
          {/* Legacy color variant picker */}
          {product.colorVariants.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Farve</p>
              <div className="flex flex-wrap gap-2">
                {product.colorVariants.map((cv) => {
                  const selected = stepState.selectedColorVariantId === cv.id;
                  return (
                    <button
                      key={cv.id}
                      type="button"
                      onClick={() =>
                        onChange({ selectedColorVariantId: cv.id, selectedLegacySkuId: null })
                      }
                      title={cv.name}
                      className={`w-8 h-8 rounded-full border-2 transition ${
                        selected
                          ? "border-secondary scale-110 shadow-md"
                          : "border-gray-200 hover:border-gray-400"
                      }`}
                      style={{ background: cv.hex }}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Legacy size picker */}
          {legacySkus.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Størrelse</p>
              <div className="flex flex-wrap gap-2">
                {legacySkus.map((sku) => {
                  const available = sku.stock > 0;
                  const selected = stepState.selectedLegacySkuId === sku.id;
                  return (
                    <button
                      key={sku.id}
                      type="button"
                      onClick={() => available && onChange({ selectedLegacySkuId: sku.id })}
                      disabled={!available}
                      className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition ${
                        selected
                          ? "bg-secondary text-white border-secondary"
                          : !available
                            ? "border-gray-200 text-gray-300 cursor-not-allowed line-through"
                            : "border-gray-300 hover:border-secondary text-gray-800"
                      }`}
                    >
                      {sku.size}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

    </div>
  );

  const confirmDialog = (
    <PrintConfirmDialog
      open={pendingAction !== null}
      onConfirm={() => { pendingAction?.(); setPendingAction(null); }}
      onCancel={() => setPendingAction(null)}
    />
  );

  // ── Designer open: canvas replaces gallery in left column ─────────────────
  if (designerAvailableForSelection && designerOpen) {
    return (
      <>
      <div className="grid md:grid-cols-2 gap-6">
        {/* Left: jersey canvas */}
        <JerseyDesignerCanvas
          product={colorAwareProduct}
          zones={effectiveDesignerZones}
          printElements={stepState.printElements}
          previewSide={effectivePreviewSide}
          clickedZoneId={clickedZoneId}
          onZoneClick={handleZoneClick}
          toastMsg={toastMsg}
        />

        {/* Right: options + designer controls */}
        <div className="space-y-3">
          {optionsJsx}
          <JerseyDesignerControls
            zones={effectiveDesignerZones}
            logos={logos}
            vatPct={vatPct}
            printElements={stepState.printElements}
            onRemovePrint={(i) =>
              onChange({ printElements: stepState.printElements.filter((_, idx) => idx !== i) })
            }
            clickedZone={clickedZone}
            onClosePanel={() => { setClickedZoneId(null); setAddText(""); onAddTextChange?.(""); }}
            addType={addType}
            onAddTypeChange={setAddType}
            addText={addText}
            onAddTextChange={handleAddTextChange}
            addLogoId={addLogoId}
            onAddLogoIdChange={setAddLogoId}
            addFontSize={addFontSize}
            onAddFontSizeChange={setAddFontSize}
            onConfirmAdd={handleConfirmAdd}
            hasBack={hasBackDesignerImage}
            previewSide={effectivePreviewSide}
            onPreviewSideChange={setPreviewSide}
            onCloseDesigner={() => { handleDesignerOpenChange(false); setClickedZoneId(null); setAddText(""); onAddTextChange?.(""); }}
          />
        </div>
      </div>
      {confirmDialog}
      </>
    );
  }

  // ── Default: gallery left, options + toggle right ─────────────────────────
  return (
    <>
    <div className="grid md:grid-cols-2 gap-6">
      {/* Left: product gallery */}
      <div>
        {displayImages.length > 0 ? (
          <div className="space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={displayImages[0]}
              alt={product.name}
              className="w-full aspect-square object-cover rounded-2xl"
            />
            {displayImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {displayImages.slice(1).map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={url}
                    alt=""
                    className="w-16 h-16 object-cover rounded-lg shrink-0"
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="w-full aspect-square bg-gray-100 rounded-2xl flex items-center justify-center text-gray-300 text-sm">
            Intet billede
          </div>
        )}
      </div>

      {/* Right: options + toggle button */}
      <div>
        {optionsJsx}
        {designerAvailableForSelection && (
          <div className="mt-5">
            <button
              type="button"
              onClick={() => handleDesignerOpenChange(true)}
              className="w-full border border-secondary text-secondary font-semibold py-2.5 px-6 rounded-xl hover:bg-secondary/5 transition text-sm"
            >
              Tilføj tryk til produktet ▼
            </button>
          </div>
        )}
      </div>
    </div>
    {confirmDialog}
    </>
  );
}

// ─── Summary step ─────────────────────────────────────────────────────────────

function SummaryStep({
  pakketilbud,
  stepStates,
  vatPct,
  onGoToStep,
}: {
  pakketilbud: PakketilbudData;
  stepStates: StepState[];
  vatPct: number;
  onGoToStep: (idx: number) => void;
}) {
  const totalCustomizationFee = pakketilbud.items.reduce((total, item, idx) => {
    const state = stepStates[idx];
    const otherGroups = item.product.optionGroups.filter(
      (g) => g.type !== "COLOR" && g.type !== "SIZE",
    );
    const optionGroupFee = otherGroups.reduce((t, g) => {
      if ((g.type === "TEXT" || g.type === "CUSTOM") && g.fee && state.textInputs[g.id]) {
        return t + g.fee;
      }
      return t;
    }, 0);
    const designerFee = state.printElements.reduce((t, el) => {
      const zone = item.product.designerZones.find((z) => z.id === el.zoneId);
      return t + (zone?.price ?? 0);
    }, 0);
    return total + optionGroupFee + designerFee;
  }, 0);

  const { effectivePrice: summaryEffectivePrice, isOnSale: summaryIsOnSale } = getEffectivePrice(pakketilbud.price, pakketilbud.salePrice, pakketilbud.salePriceStart, pakketilbud.salePriceEnd);
  const totalPrice = summaryEffectivePrice + totalCustomizationFee;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Din pakke</h3>
      <div className="border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b text-left text-gray-500">
              <th className="px-4 py-2 font-medium">Produkt</th>
              <th className="px-4 py-2 font-medium">Farve / Størrelse</th>
              <th className="px-4 py-2 font-medium">Tryk</th>
              <th className="px-4 py-2 font-medium text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pakketilbud.items.map((item, idx) => {
              const state = stepStates[idx];
              const product = item.product;
              const hasOptionGroups = product.optionGroups.length > 0;

              let colorName = "";
              let sizeName = "";
              let printText = "";

              if (hasOptionGroups) {
                const colorGroup = product.optionGroups.find((g) => g.type === "COLOR");
                const sizeGroup = product.optionGroups.find((g) => g.type === "SIZE");
                colorName = colorGroup?.values.find((v) => v.id === state.selectedOptions[colorGroup.id])?.label ?? "";
                sizeName = sizeGroup?.values.find((v) => v.id === state.selectedOptions[sizeGroup?.id ?? ""])?.label ?? "";
                const textGroups = product.optionGroups.filter(
                  (g) => g.type !== "COLOR" && g.type !== "SIZE",
                );
                printText = textGroups
                  .filter((g) => state.textInputs[g.id])
                  .map((g) => `${g.label}: ${state.textInputs[g.id]}`)
                  .join(", ");
              } else {
                const cv = product.colorVariants.find((c) => c.id === state.selectedColorVariantId);
                colorName = cv?.name ?? "";
                const sku =
                  product.colorVariants.length > 0
                    ? cv?.skus.find((s) => s.id === state.selectedLegacySkuId)
                    : product.skus.find((s) => s.id === state.selectedLegacySkuId);
                sizeName = sku?.size ?? "";
                if (state.withCustomization) {
                  const parts = [state.customName, state.customNumber].filter(Boolean);
                  printText = parts.join(" / ");
                }
              }

              // Designer prints
              if (state.printElements.length > 0) {
                const designerParts = state.printElements.map(
                  (el) => `${el.zoneLabel}: ${el.type === "text" ? el.value : "Logo"}`,
                );
                printText = [printText, ...designerParts].filter(Boolean).join(", ");
              }

              return (
                <tr key={item.id}>
                  <td className="px-4 py-3 font-medium">{item.label ?? item.product.name}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {[colorName, sizeName].filter(Boolean).join(" / ") || "–"}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{printText || "–"}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onGoToStep(idx)}
                      className="text-xs text-secondary hover:underline"
                    >
                      Rediger
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="text-right text-sm text-gray-500">
        Pakkepris:{" "}
        {summaryIsOnSale && (
          <span className="line-through text-gray-400 mr-1">{formatPrice(withVat(pakketilbud.price + totalCustomizationFee, vatPct))}</span>
        )}
        <span className={`font-bold ${summaryIsOnSale ? "text-red-600" : "text-gray-900"}`}>{formatPrice(withVat(totalPrice, vatPct))}</span>
        <span className="ml-1 text-xs">inkl. moms</span>
        {totalCustomizationFee > 0 && (
          <span className="ml-2 text-xs">(inkl. tryk)</span>
        )}
      </div>
    </div>
  );
}

// ─── Main wizard ─────────────────────────────────────────────────────────────

export function PakketilbudWizard({
  pakketilbud,
  vatPct,
  isSoldOut = false,
  logos = [],
  onBack,
}: {
  pakketilbud: PakketilbudData;
  vatPct: number;
  isSoldOut?: boolean;
  logos?: DesignerLogo[];
  onBack?: () => void;
}) {
  const { addItem } = useCart();
  const { effectivePrice: pakkeEffectivePrice, isOnSale: pakkeIsOnSale } = getEffectivePrice(pakketilbud.price, pakketilbud.salePrice, pakketilbud.salePriceStart, pakketilbud.salePriceEnd);
  const [currentStep, setCurrentStep] = useState(0);
  const [stepStates, setStepStates] = useState<StepState[]>(() =>
    pakketilbud.items.map((item) => initialStep(item.product)),
  );
  const [stepAddText, setStepAddText] = useState("");
  const [stepDesignerOpen, setStepDesignerOpen] = useState(false);
  const [pendingNavAction, setPendingNavAction] = useState<(() => void) | null>(null);

  function withNavTextConfirm(action: () => void) {
    if (stepDesignerOpen && stepAddText.trim().length > 0) {
      setPendingNavAction(() => action);
    } else {
      action();
    }
  }

  const totalSteps = pakketilbud.items.length; // last "step" = summary (index = totalSteps)
  const isSummary = currentStep === totalSteps;

  function updateStep(idx: number, patch: Partial<StepState>) {
    setStepStates((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  const currentComplete = isSummary
    ? true
    : isStepComplete(stepStates[currentStep], pakketilbud.items[currentStep].product);

  const allComplete = useMemo(
    () => pakketilbud.items.every((item, idx) => isStepComplete(stepStates[idx], item.product)),
    [pakketilbud.items, stepStates],
  );

  function handleAddToCart() {
    if (!allComplete) {
      toast.error("Udfyld venligst alle varer i pakken");
      return;
    }

    const totalCustomizationFee = pakketilbud.items.reduce((total, item, idx) => {
      const state = stepStates[idx];
      const otherGroups = item.product.optionGroups.filter(
        (g) => g.type !== "COLOR" && g.type !== "SIZE",
      );
      const optionGroupFee = otherGroups.reduce((t, g) => {
        if ((g.type === "TEXT" || g.type === "CUSTOM") && g.fee && state.textInputs[g.id]) {
          return t + g.fee;
        }
        return t;
      }, 0);
      const designerFee = state.printElements.reduce((t, el) => {
        const zone = item.product.designerZones.find((z) => z.id === el.zoneId);
        return t + (zone?.price ?? 0);
      }, 0);
      return total + optionGroupFee + designerFee;
    }, 0);

    const pakketilbudItems = pakketilbud.items.map((item, idx) => {
      const state = stepStates[idx];
      const product = item.product;
      const hasOptionGroups = product.optionGroups.length > 0;

      let skuId = "";
      let size = "";
      let colorName: string | undefined;
      let customName: string | undefined;
      let customNumber: string | undefined;
      let customizationFee: number | undefined;

      if (hasOptionGroups) {
        const colorGroup = product.optionGroups.find((g) => g.type === "COLOR");
        const sizeGroup = product.optionGroups.find((g) => g.type === "SIZE");
        const sku = resolveSkuFromOptions(product.skus, state.selectedOptions, product.optionGroups);
        skuId = sku?.id ?? "";
        size = sizeGroup?.values.find((v) => v.id === state.selectedOptions[sizeGroup?.id ?? ""])?.label ?? sku?.size ?? "";
        colorName = colorGroup?.values.find((v) => v.id === state.selectedOptions[colorGroup.id])?.label;

        const textGroups = product.optionGroups.filter((g) => g.type !== "COLOR" && g.type !== "SIZE");
        for (const g of textGroups) {
          if (state.textInputs[g.id] && (g.type === "TEXT" || g.type === "CUSTOM")) {
            if (!customName) customName = state.textInputs[g.id];
          }
        }

        const itemFee = textGroups.reduce((t, g) => {
          if ((g.type === "TEXT" || g.type === "CUSTOM") && g.fee && state.textInputs[g.id]) {
            return t + g.fee;
          }
          return t;
        }, 0);
        if (itemFee > 0) customizationFee = itemFee;
      } else {
        const cv = product.colorVariants.find((c) => c.id === state.selectedColorVariantId);
        colorName = cv?.name;
        const sku =
          product.colorVariants.length > 0
            ? cv?.skus.find((s) => s.id === state.selectedLegacySkuId)
            : product.skus.find((s) => s.id === state.selectedLegacySkuId);
        skuId = sku?.id ?? "";
        size = sku?.size ?? "";
      }

      // Auto-inject fixed zone logos
      const fixedElements: PrintElement[] = product.designerZones
        .filter((z) => z.fixedLogo)
        .map((z) => ({
          side: z.side as "front" | "back",
          zoneId: z.id,
          zoneLabel: z.label,
          position: z.position,
          type: "logo" as const,
          value: String(z.fixedLogo!.id),
          logoUrl: z.fixedLogo!.imageUrl,
          fontSize: "medium" as const,
        }));
      const allPrintElements = [...fixedElements, ...state.printElements];

      // Add designer zone fees
      const designerFee = allPrintElements.reduce((t, el) => {
        const zone = product.designerZones.find((z) => z.id === el.zoneId);
        return t + (zone?.price ?? 0);
      }, 0);
      if (designerFee > 0) customizationFee = (customizationFee ?? 0) + designerFee;

      return {
        itemId: item.id,
        productId: product.id,
        productName: product.name,
        label: item.label ?? undefined,
        skuId,
        size,
        colorName,
        customName,
        customNumber,
        customizationFee,
        printElements: allPrintElements.length > 0 ? allPrintElements : undefined,
      };
    });

    addItem({
      skuId: `pakke::${pakketilbud.id}`,
      productId: pakketilbud.id,
      productName: pakketilbud.name,
      size: "",
      price: pakkeEffectivePrice,
      image: pakketilbud.images[0],
      isPakketilbud: true,
      pakketilbudId: pakketilbud.id,
      customizationFee: totalCustomizationFee > 0 ? totalCustomizationFee : undefined,
      pakketilbudItems,
      quantity: 1,
      isOnSale: pakkeIsOnSale,
    });

    toast.success(`${pakketilbud.name} lagt i kurven`);
  }

  return (
    <div className="flex gap-8 items-start">
      {/* Step list sidebar */}
      <aside className="hidden md:block w-48 shrink-0">
        <ul className="space-y-1">
          {pakketilbud.items.map((item, idx) => {
            const complete = isStepComplete(stepStates[idx], item.product);
            const active = currentStep === idx;
            const accessible = idx <= currentStep || complete;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => accessible && setCurrentStep(idx)}
                  disabled={!accessible}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition ${
                    active
                      ? "bg-secondary text-white font-semibold"
                      : complete
                        ? "text-green-700 hover:bg-green-50"
                        : accessible
                          ? "text-gray-600 hover:bg-gray-100"
                          : "text-gray-300 cursor-not-allowed"
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 text-xs font-bold ${
                      active
                        ? "border-white text-white"
                        : complete
                          ? "border-green-500 bg-green-500 text-white"
                          : "border-gray-300 text-gray-400"
                    }`}
                  >
                    {complete && !active ? <Check size={10} strokeWidth={3} /> : idx + 1}
                  </span>
                  <span className="truncate">{item.label ?? item.product.name}</span>
                </button>
              </li>
            );
          })}
          {/* Summary step */}
          <li>
            <button
              type="button"
              onClick={() => allComplete && setCurrentStep(totalSteps)}
              disabled={!allComplete}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition ${
                isSummary
                  ? "bg-secondary text-white font-semibold"
                  : allComplete
                    ? "text-gray-600 hover:bg-gray-100"
                    : "text-gray-300 cursor-not-allowed"
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 text-xs font-bold ${
                  isSummary ? "border-white text-white" : "border-gray-300 text-gray-400"
                }`}
              >
                <ChevronRight size={10} />
              </span>
              Oversigt
            </button>
          </li>
        </ul>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="mt-4 text-xs text-gray-400 hover:text-secondary flex items-center gap-1"
          >
            ← Tilbage til pakken
          </button>
        )}
      </aside>

      {/* Step content */}
      <div className="flex-1 min-w-0">
        {/* Mobile step indicator */}
        <div className="md:hidden mb-4 flex items-center gap-2 overflow-x-auto pb-1">
          {pakketilbud.items.map((item, idx) => {
            const complete = isStepComplete(stepStates[idx], item.product);
            const active = currentStep === idx;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => (idx <= currentStep || complete) && setCurrentStep(idx)}
                className={`shrink-0 flex items-center justify-center w-8 h-8 rounded-full border-2 text-xs font-bold transition ${
                  active
                    ? "bg-secondary border-secondary text-white"
                    : complete
                      ? "bg-green-500 border-green-500 text-white"
                      : "border-gray-300 text-gray-400"
                }`}
              >
                {complete && !active ? <Check size={10} strokeWidth={3} /> : idx + 1}
              </button>
            );
          })}
          <div
            className={`shrink-0 flex items-center justify-center w-8 h-8 rounded-full border-2 text-xs transition ${
              isSummary ? "bg-secondary border-secondary text-white" : "border-gray-300 text-gray-400"
            }`}
          >
            <ChevronRight size={12} />
          </div>
        </div>

        {/* Step header */}
        {!isSummary && (
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest mb-2">
            Trin {currentStep + 1} af {totalSteps}
          </p>
        )}

        {/* Content */}
        {isSummary ? (
          <SummaryStep
            pakketilbud={pakketilbud}
            stepStates={stepStates}
            vatPct={vatPct}
            onGoToStep={setCurrentStep}
          />
        ) : (
          <ItemStep
            item={pakketilbud.items[currentStep]}
            stepState={stepStates[currentStep]}
            onChange={(patch) => updateStep(currentStep, patch)}
            vatPct={vatPct}
            logos={logos}
            stepIndex={currentStep}
            onAddTextChange={setStepAddText}
            onDesignerOpenChange={setStepDesignerOpen}
          />
        )}

        {/* Navigation */}
        <div className="flex gap-3 mt-6">
          {currentStep > 0 && (
            <button
              type="button"
              onClick={() => withNavTextConfirm(() => setCurrentStep((s) => s - 1))}
              className="px-5 py-2.5 border rounded-xl text-sm hover:bg-gray-50 transition"
            >
              ← Forrige
            </button>
          )}

          {isSummary ? (
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={!allComplete || isSoldOut}
              className="ml-auto bg-primary text-secondary font-bold px-6 py-2.5 rounded-xl hover:bg-primary-dark transition disabled:opacity-60 text-sm"
            >
              {isSoldOut ? "Ikke tilgængelig" : "Tilføj til kurven"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => withNavTextConfirm(() => setCurrentStep((s) => s + 1))}
              disabled={!currentComplete}
              className="ml-auto bg-secondary text-white font-bold px-6 py-2.5 rounded-xl hover:bg-secondary-dark transition disabled:opacity-60 text-sm"
            >
              {currentStep === totalSteps - 1 ? "Se oversigt →" : "Næste →"}
            </button>
          )}
        </div>
      </div>
      <PrintConfirmDialog
        open={pendingNavAction !== null}
        onConfirm={() => { pendingNavAction?.(); setPendingNavAction(null); }}
        onCancel={() => setPendingNavAction(null)}
      />
    </div>
  );
}
