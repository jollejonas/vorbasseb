"use client";

import { useState } from "react";
import { useCart, type PrintElement } from "./CartProvider";
import { formatPrice, withVat } from "@/lib/utils";
import { getEffectivePrice } from "@/lib/pricing";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import { applyDesignerZonePlacements } from "@/lib/designerZonePlacements";
import { PrintConfirmDialog } from "./PrintConfirmDialog";
import { GroupOrderConfirmDialog } from "./GroupOrderConfirmDialog";
import type { Product, SKU, DesignerZone, DesignerLogo, ProductOptionGroup, ProductOptionValue, SKUOptionValue, GlobalColor } from "@prisma/client";

type SkuFull = SKU & { optionValues: { optionValueId: string }[] };
type OptionGroupFull = ProductOptionGroup & { values: (ProductOptionValue & { globalColor: GlobalColor | null; skuValues: SKUOptionValue[] })[] };
type ZoneWithFixedLogo = DesignerZone & { fixedLogo: DesignerLogo | null };

type Props = {
  product: Product;
  zones: ZoneWithFixedLogo[];
  logos: DesignerLogo[];
  skus: SkuFull[];
  vatPct?: number;
  optionGroups: OptionGroupFull[];
};

const FONT_SIZE_LABELS = { small: "Lille", medium: "Medium", large: "Stor" } as const;

export function JerseyDesignerSection({ product, zones, logos, skus, vatPct = 25, optionGroups }: Props) {
  const { addItem } = useCart();
  const { effectivePrice, isOnSale } = getEffectivePrice(product.price, product.salePrice, product.salePriceStart, product.salePriceEnd);

  const [isDesignerOpen, setIsDesignerOpen] = useState(false);
  const [previewSide, setPreviewSide] = useState<"front" | "back">("front");
  // Keyed by color option-value ID (or "_default" for products with no color group)
  const [printElementsByColor, setPrintElementsByColor] = useState<Record<string, PrintElement[]>>({});

  // Zone clicked to start add flow
  const [clickedZoneId, setClickedZoneId] = useState<number | null>(null);
  const [addType, setAddType] = useState<"text" | "logo">("text");
  const [addText, setAddText] = useState("");
  const [addLogoId, setAddLogoId] = useState<number | null>(null);
  const [addFontSize, setAddFontSize] = useState<"small" | "medium" | "large">("medium");
  const [toast, setToast] = useState<string | null>(null);

  // Option selections (covers COLOR, SIZE, SELECT, CUSTOM) — auto-select first color
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(() => {
    const colorGrp = optionGroups.find((g) => g.type === "COLOR");
    if (colorGrp?.values[0]) return { [colorGrp.id]: colorGrp.values[0].id };
    return {};
  });
  const [textInputs, setTextInputs] = useState<Record<string, string>>({});
  const [added, setAdded] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [showGroupOrderDialog, setShowGroupOrderDialog] = useState(false);

  function withTextConfirm(action: () => void) {
    if (isDesignerOpen && clickedZoneId !== null && addText.trim().length > 0) {
      setPendingAction(() => action);
    } else {
      action();
    }
  }

  const colorGroup = optionGroups.find((g) => g.type === "COLOR");
  const sizeGroup = optionGroups.find((g) => g.type === "SIZE");
  const otherGroups = optionGroups.filter((g) => g.type !== "COLOR" && g.type !== "SIZE");
  const colorGroupId = colorGroup?.id;
  const sizeGroupId = sizeGroup?.id;

  // Color-aware static image (shown when designer is closed)
  const selectedColorValue = colorGroup?.values.find((v) => v.id === selectedOptions[colorGroup!.id]);
  const effectiveZones = applyDesignerZonePlacements(
    zones,
    selectedColorValue?.designerZonePlacements
  );

  // Per-color print element key and current slice
  const colorKey = selectedColorValue?.id ?? "_default";
  const printElements = printElementsByColor[colorKey] ?? [];
  function setPrintElements(updater: PrintElement[] | ((prev: PrintElement[]) => PrintElement[])) {
    setPrintElementsByColor((prev) => {
      const current = prev[colorKey] ?? [];
      const next = typeof updater === "function" ? updater(current) : updater;
      return { ...prev, [colorKey]: next };
    });
  }
  const activeStaticImage =
    (selectedColorValue?.images ?? []).length > 0
      ? selectedColorValue!.images[0]
      : product.images[0];

  // Per-color designer image resolution
  // If a color is selected and has designer images configured → use those; otherwise fall back to product-level
  const colorImages = selectedColorValue?.images ?? [];
  const selectedColorFrontImage =
    selectedColorValue?.designerFrontImageIdx != null
      ? (colorImages[selectedColorValue.designerFrontImageIdx] ?? null)
      : null;
  const selectedColorBackImage =
    selectedColorValue?.designerBackImageIdx != null
      ? (colorImages[selectedColorValue.designerBackImageIdx] ?? null)
      : null;
  const productFrontImage =
    product.images[product.designerFrontImageIdx ?? 0] ??
    product.images[0] ??
    null;
  const productBackImage =
    product.designerBackImageIdx != null
      ? (product.images[product.designerBackImageIdx] ?? null)
      : null;
  const frontImage = selectedColorFrontImage ?? productFrontImage;
  const backImage = selectedColorBackImage ?? productBackImage;
  const printColor =
    (selectedColorValue?.designerPrintColor) ||
    product.designerPrintColor ||
    "#FFFFFF";

  // Designer is available for this color only if the color value has a front image configured
  // (or if there is no color group at all — single-color product using product-level settings)
  const colorDesignerAvailable = frontImage !== null;

  // Has a back designer image available (for front/back toggle)
  const hasBackImage = backImage !== null;

  const previewImage = previewSide === "front" ? frontImage : (backImage ?? frontImage);

  const interactiveZones = effectiveZones.filter((z) => !z.fixedLogo);
  const fixedZones = effectiveZones.filter((z) => z.fixedLogo);
  const visibleZones = interactiveZones.filter((z) => z.side === previewSide);
  const visibleElements = printElements.filter((p) => p.side === previewSide);

  const zoneMap = new Map<number, DesignerZone>();
  effectiveZones.forEach((z) => zoneMap.set(z.id, z));

  const clickedZone = clickedZoneId !== null ? (zoneMap.get(clickedZoneId) ?? null) : null;

  function handleZoneClick(zone: DesignerZone) {
    setClickedZoneId(zone.id);
    if (zone.allowText && !zone.allowLogo) setAddType("text");
    else if (!zone.allowText && zone.allowLogo) setAddType("logo");
    else setAddType("text");
    setAddText("");
    setAddLogoId(null);
    setAddFontSize("medium");
    setPreviewSide(zone.side as "front" | "back");
  }

  function confirmAddElement() {
    if (!clickedZone) return;
    const logo = addType === "logo" && addLogoId !== null ? logos.find((l) => l.id === addLogoId) : undefined;
    if (addType === "text" && !addText.trim()) return;
    if (addType === "logo" && !logo) return;

    setPrintElements((prev) => [
      ...prev,
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
    ]);

    const label = clickedZone.label;
    setClickedZoneId(null);
    setAddText("");
    setAddLogoId(null);
    setToast(`Tryk tilføjet til ${label}`);
    setTimeout(() => setToast(null), 2500);
  }

  function removePrint(idx: number) {
    setPrintElements((prev) => prev.filter((_, i) => i !== idx));
  }

  const activeSku: SkuFull | null = (() => {
    const required: string[] = [];
    if (colorGroupId) {
      const id = selectedOptions[colorGroupId];
      if (!id) return null;
      required.push(id);
    }
    if (sizeGroupId) {
      const id = selectedOptions[sizeGroupId];
      if (!id) return null;
      required.push(id);
    }
    if (!required.length) return skus.find((s) => s.stock > 0) ?? skus[0] ?? null;
    return (
      skus.find((sku) => {
        const ids = sku.optionValues.map((sv) => sv.optionValueId);
        return required.every((id) => ids.includes(id)) && sku.stock > 0;
      }) ?? null
    );
  })();

  function doAddToCart() {
    if (!activeSku) return;
    const selectedSizeLabel = sizeGroup
      ? (sizeGroup.values.find((v) => v.id === selectedOptions[sizeGroup.id])?.label ?? activeSku.size ?? "One Size")
      : (activeSku.size ?? "One Size");

    const optionSelections = otherGroups.flatMap((g) => {
      if (g.type === "TEXT" || g.type === "CUSTOM") {
        const val = textInputs[g.id]?.trim();
        return val ? [{ groupLabel: g.label, value: val }] : [];
      }
      const v = g.values.find((v) => v.id === selectedOptions[g.id]);
      return v ? [{ groupLabel: g.label, value: v.label }] : [];
    });

    const fixedElements: PrintElement[] = fixedZones.map((z) => ({
      side: z.side as "front" | "back",
      zoneId: z.id,
      zoneLabel: z.label,
      position: z.position,
      type: "logo" as const,
      value: String(z.fixedLogo!.id),
      logoUrl: z.fixedLogo!.imageUrl,
      fontSize: "medium" as const,
    }));

    const allPrintElements = [...fixedElements, ...printElements];
    const designerFee = allPrintElements.reduce((sum, el) => {
      const zone = zoneMap.get(el.zoneId);
      return sum + (zone?.price ?? 0);
    }, 0);

    addItem({
      skuId: activeSku.id,
      productId: product.id,
      productName: product.name,
      size: selectedSizeLabel,
      price: effectivePrice,
      quantity: 1,
      image: activeStaticImage ?? product.images[0],
      clubRoleRequired: product.clubRoleRequired ?? null,
      colorName: selectedColorValue?.label || undefined,
      printElements: allPrintElements,
      optionSelections: optionSelections.length > 0 ? optionSelections : undefined,
      customizationFee: designerFee > 0 ? designerFee : undefined,
      isOnSale,
      isGroupOrder: product.isGroupOrder,
      groupOrderDeadline: product.groupOrderDeadline ? product.groupOrderDeadline.toISOString() : null,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  function handleAddToCart() {
    if (!activeSku) return;
    if (product.isGroupOrder) {
      setShowGroupOrderDialog(true);
      return;
    }
    doAddToCart();
  }

  const canAddToCart = activeSku !== null && activeSku.stock > 0;
  const isDisabled =
    !canAddToCart ||
    (!!colorGroup && !selectedOptions[colorGroup.id]) ||
    (!!sizeGroup && !selectedOptions[sizeGroup.id]) ||
    otherGroups.some((g) => g.required && !selectedOptions[g.id] && !textInputs[g.id]?.trim());

  return (
    <>
    <div className="grid md:grid-cols-[55%_45%] gap-8 items-start">
      {/* LEFT — product image (closed) or jersey canvas (open) */}
      <div className="space-y-4">
        {isDesignerOpen ? (
          <>
            {/* Front/Back toggle */}
            {hasBackImage && (
              <div className="flex gap-2">
                <button
                  onClick={() => setPreviewSide("front")}
                  className={`px-3 py-1 text-sm rounded-lg border transition ${previewSide === "front" ? "bg-secondary text-white border-secondary" : "border-gray-200 text-gray-600 hover:border-gray-400"}`}
                >
                  Forside
                </button>
                <button
                  onClick={() => setPreviewSide("back")}
                  className={`px-3 py-1 text-sm rounded-lg border transition ${previewSide === "back" ? "bg-secondary text-white border-secondary" : "border-gray-200 text-gray-600 hover:border-gray-400"}`}
                >
                  Bagside
                </button>
              </div>
            )}

            {/* Jersey image with clickable zone rects + print overlays */}
            <div className="relative w-full rounded-xl overflow-hidden bg-gray-50 border border-gray-100">
              {previewImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewImage} alt={`${product.name} ${previewSide}`} className="w-full object-contain" />
              ) : (
                <div className="aspect-square flex items-center justify-center text-gray-300 text-sm">Intet billede</div>
              )}

              {/* Clickable zone rectangles */}
              {visibleZones.map((zone) => {
                const isActive = zone.id === clickedZoneId;
                return (
                  <button
                    key={zone.id}
                    type="button"
                    onClick={() => handleZoneClick(zone)}
                    className="absolute transition-all"
                    style={{
                      left: `${zone.previewX}%`,
                      top: `${zone.previewY}%`,
                      width: `${zone.previewW}%`,
                      height: `${zone.previewH}%`,
                      border: isActive
                        ? "2px solid rgba(59,130,246,0.9)"
                        : "1.5px dashed rgba(255,255,255,0.65)",
                      background: isActive ? "rgba(59,130,246,0.18)" : "rgba(255,255,255,0.04)",
                      boxShadow: isActive ? "0 0 0 2px rgba(59,130,246,0.35)" : undefined,
                      borderRadius: "3px",
                      cursor: "pointer",
                    }}
                  ></button>
                );
              })}

              {/* Print element overlays — centered within zone rect */}
              {visibleElements.map((el, i) => {
                const zone = zoneMap.get(el.zoneId);
                if (!zone) return null;
                const cx = zone.previewX + zone.previewW / 2;
                const cy = zone.previewY + zone.previewH / 2;
                const fontSizeClass = el.fontSize === "small" ? "text-xs" : el.fontSize === "large" ? "text-lg font-bold" : "text-sm font-semibold";
                return (
                  <div
                    key={i}
                    className="absolute pointer-events-none"
                    style={{ left: `${cx}%`, top: `${cy}%`, transform: "translate(-50%, -50%)" }}
                  >
                    {el.type === "text" ? (
                      <span
                        className={`${fontSizeClass} drop-shadow`}
                        style={{ color: printColor, textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}
                      >
                        {el.value}
                      </span>
                    ) : el.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={el.logoUrl} alt={el.zoneLabel} className="h-8 w-auto object-contain drop-shadow" />
                    ) : null}
                  </div>
                );
              })}

              {/* Fixed logo overlays — always rendered, not clickable by customer */}
              {fixedZones.filter((z) => z.side === previewSide).map((z) => (
                <div
                  key={`fixed-${z.id}`}
                  className="absolute pointer-events-none flex items-center justify-center"
                  style={{
                    left: `${z.previewX}%`,
                    top: `${z.previewY}%`,
                    width: `${z.previewW}%`,
                    height: `${z.previewH}%`,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={z.fixedLogo!.imageUrl} alt={z.label} className="max-w-full max-h-full object-contain drop-shadow" />
                </div>
              ))}
            </div>

            {visibleZones.length > 0 && !clickedZoneId && (
              <p className="text-xs text-center text-gray-400">Klik på en zone for at tilføje tryk</p>
            )}
            {toast && (
              <p className="text-xs text-center text-green-600 font-medium">{toast}</p>
            )}

            {/* Compact add panel — shown when a zone is clicked */}
            {clickedZone && (
              <div className="border rounded-xl p-4 space-y-4 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-700">
                      {clickedZone.label}
                      <span className="text-xs text-gray-400 font-normal ml-2">
                        {clickedZone.side === "front" ? "Forside" : "Bagside"}
                      </span>
                    </p>
                    {clickedZone.tipText && (
                      <p className="text-xs text-gray-500 mt-0.5">{clickedZone.tipText}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => { setClickedZoneId(null); setAddText(""); }}
                    className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                  >
                    ×
                  </button>
                </div>

                {/* Type toggle — only when zone supports both */}
                {clickedZone.allowText && clickedZone.allowLogo && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setAddType("text")}
                      className={`px-3 py-1.5 text-sm rounded-lg border transition ${addType === "text" ? "bg-secondary text-white border-secondary" : "border-gray-200 hover:border-gray-400"}`}
                    >
                      Tekst
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddType("logo")}
                      className={`px-3 py-1.5 text-sm rounded-lg border transition ${addType === "logo" ? "bg-secondary text-white border-secondary" : "border-gray-200 hover:border-gray-400"}`}
                    >
                      Logo
                    </button>
                  </div>
                )}

                {/* Text input + font size */}
                {clickedZone.allowText && addType === "text" && (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={addText}
                      onChange={(e) => setAddText(e.target.value.toUpperCase())}
                      placeholder="f.eks. JENSEN eller 10"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                      style={{ textTransform: "uppercase" }}
                      maxLength={30}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      {(["small", "medium", "large"] as const).map((fs) => (
                        <button
                          key={fs}
                          type="button"
                          onClick={() => setAddFontSize(fs)}
                          className={`px-3 py-1.5 text-sm rounded-lg border transition ${addFontSize === fs ? "bg-secondary text-white border-secondary" : "border-gray-200 hover:border-gray-400"}`}
                        >
                          {FONT_SIZE_LABELS[fs]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Logo picker */}
                {clickedZone.allowLogo && addType === "logo" && (
                  logos.length === 0 ? (
                    <p className="text-xs text-gray-400">Ingen logoer tilgængelige.</p>
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      {logos.map((l) => (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => setAddLogoId(l.id)}
                          className={`p-2 rounded-lg border transition ${addLogoId === l.id ? "border-secondary ring-2 ring-secondary/30" : "border-gray-200 hover:border-gray-400"}`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={l.imageUrl} alt={l.name} className="h-12 w-12 object-contain" />
                          <p className="text-xs text-center text-gray-500 mt-1">{l.name}</p>
                        </button>
                      ))}
                    </div>
                  )
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={confirmAddElement}
                    disabled={(addType === "text" && !addText.trim()) || (addType === "logo" && addLogoId === null)}
                    className="bg-secondary text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
                  >
                    Tilføj
                  </button>
                  <button
                    type="button"
                    onClick={() => { setClickedZoneId(null); setAddText(""); }}
                    className="border border-gray-200 px-4 py-2 rounded-lg text-sm text-gray-600 hover:border-gray-400"
                  >
                    Annuller
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Static product image when designer is closed */
          activeStaticImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={activeStaticImage}
              alt={product.name}
              className="w-full aspect-square object-contain rounded-2xl"
            />
          ) : (
            <div className="w-full aspect-square bg-gray-100 rounded-2xl flex items-center justify-center text-gray-400">
              Intet billede
            </div>
          )
        )}
      </div>

      {/* RIGHT — title, options, designer toggle, prints, cart */}
      <div className="space-y-3">
        {/* Product info */}
        <div>
          {product.membersOnly && (
            <span className="inline-block bg-secondary text-white text-xs font-semibold px-3 py-1 rounded-full mb-2">
              Kun for fanklubsmedlemmer
            </span>
          )}
          <h1 className="text-xl font-bold mb-0">{product.name}</h1>
          {isOnSale ? (
            <p className="text-lg mb-1">
              <span className="line-through text-gray-400 mr-2">{formatPrice(withVat(product.price, vatPct))}</span>
              <span className="font-bold text-red-600">{formatPrice(withVat(effectivePrice, vatPct))}</span>
              <span className="text-sm text-gray-400 font-normal ml-1">inkl. moms</span>
            </p>
          ) : (
            <p className="text-lg font-bold text-secondary mb-1">
              {formatPrice(withVat(product.price, vatPct))}
              <span className="text-sm text-gray-400 font-normal ml-1">inkl. moms</span>
            </p>
          )}
          <div className={`grid transition-all duration-300 ${isDesignerOpen ? "grid-rows-[0fr]" : "grid-rows-[1fr]"}`}>
            <div className="overflow-hidden">
              {product.description && (
                <div className="product-content" dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.description) }} />
              )}
            </div>
          </div>
        </div>

        {/* COLOR swatches */}
        {colorGroup && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">
              {colorGroup.label}
              {selectedColorValue && (
                <span className="ml-2 font-bold text-secondary">– {selectedColorValue.label}</span>
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              {colorGroup.values.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => withTextConfirm(() => {
                    setSelectedOptions((p) => ({ ...p, [colorGroup.id]: v.id }));
                    // Close designer if neither per-color nor product-level fallback has a front image.
                    const colorFrontImage =
                      v.designerFrontImageIdx != null
                        ? (v.images[v.designerFrontImageIdx] ?? null)
                        : null;
                    const colorBackImage =
                      v.designerBackImageIdx != null
                        ? (v.images[v.designerBackImageIdx] ?? null)
                        : null;
                    const fallbackFrontImage =
                      product.images[product.designerFrontImageIdx ?? 0] ??
                      product.images[0] ??
                      null;
                    const fallbackBackImage =
                      product.designerBackImageIdx != null
                        ? (product.images[product.designerBackImageIdx] ?? null)
                        : null;
                    const hasDesigner = colorFrontImage !== null || fallbackFrontImage !== null;
                    const hasBackDesigner = colorBackImage !== null || fallbackBackImage !== null;
                    if (!hasDesigner && isDesignerOpen) { setIsDesignerOpen(false); setClickedZoneId(null); }
                    if (!hasBackDesigner && previewSide === "back") {
                      setPreviewSide("front");
                      if (clickedZone?.side === "back") setClickedZoneId(null);
                    }
                  })}
                  title={v.label}
                  className={`w-8 h-8 rounded-full border-2 transition ${
                    selectedOptions[colorGroup.id] === v.id
                      ? "border-secondary scale-110 shadow-md"
                      : "border-gray-200 hover:border-gray-400"
                  }`}
                  style={{ background: v.globalColor?.hex ?? "#ccc" }}
                  aria-label={v.label}
                  aria-pressed={selectedOptions[colorGroup.id] === v.id}
                />
              ))}
            </div>
          </div>
        )}

        {/* SIZE buttons */}
        {sizeGroup && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{sizeGroup.label}</label>
            <div className="flex flex-wrap gap-2">
              {sizeGroup.values.map((v) => {
                const sizeSkus = skus.filter((s) => s.optionValues.some((sv) => sv.optionValueId === v.id));
                const inStock = sizeSkus.some((s) => s.stock > 0);
                return (
                  <button
                    key={v.id}
                    type="button"
                    disabled={!inStock}
                    onClick={() => withTextConfirm(() => setSelectedOptions((p) => ({ ...p, [sizeGroup.id]: v.id })))}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition ${
                      selectedOptions[sizeGroup.id] === v.id
                        ? "bg-secondary text-white border-secondary"
                        : inStock
                        ? "border-gray-200 hover:border-secondary hover:text-secondary"
                        : "border-gray-100 text-gray-300 cursor-not-allowed"
                    }`}
                  >
                    {v.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* OTHER option groups (TEXT, SELECT, CUSTOM) */}
        {otherGroups.map((g) => (
          <div key={g.id}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {g.label}
              {g.required && <span className="text-red-400 ml-1">*</span>}
            </label>
            {g.type === "SELECT" ? (
              <div className="flex flex-wrap gap-2">
                {g.values.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelectedOptions((p) => ({ ...p, [g.id]: v.id }))}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition ${
                      selectedOptions[g.id] === v.id
                        ? "bg-secondary text-white border-secondary"
                        : "border-gray-200 hover:border-secondary hover:text-secondary"
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            ) : (
              <input
                type="text"
                value={textInputs[g.id] ?? ""}
                onChange={(e) => setTextInputs((p) => ({ ...p, [g.id]: e.target.value }))}
                placeholder={g.inputType === "number" ? "f.eks. 10" : "f.eks. Jensen"}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            )}
          </div>
        ))}

        {/* Designer toggle button — hidden if selected color has no designer images configured */}
        {colorDesignerAvailable ? (
          <button
            type="button"
            onClick={() => {
              setIsDesignerOpen(!isDesignerOpen);
              setClickedZoneId(null);
            }}
            className="w-full border border-secondary text-secondary font-semibold py-2.5 px-6 rounded-xl hover:bg-secondary/5 transition text-sm"
          >
            {isDesignerOpen ? "Skjul tryk-designer ▲" : "Tilføj tryk til produktet ▼"}
          </button>
        ) : colorGroup ? (
          <p className="text-sm text-center text-gray-400 py-2">Tryk-designer er ikke tilgængelig for denne farve</p>
        ) : null}

        {/* Prints list — only when designer is open */}
        {isDesignerOpen && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Tryk ({printElements.length})</p>
            {printElements.length === 0 ? (
              <p className="text-sm text-gray-400">Ingen tryk tilføjet endnu.</p>
            ) : (
              printElements.map((el, i) => (
                <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                  <div>
                    <span className="font-medium">{el.zoneLabel}</span>
                    <span className="text-gray-400 mx-1">·</span>
                    <span className="text-gray-500">{el.side === "front" ? "Forside" : "Bagside"}</span>
                    <span className="text-gray-400 mx-1">·</span>
                    {el.type === "text" ? (
                      <span className="font-mono">{el.value} <span className="text-gray-400">({FONT_SIZE_LABELS[el.fontSize]})</span></span>
                    ) : (
                      <span>Logo</span>
                    )}
                  </div>
                  <button onClick={() => removePrint(i)} className="text-red-400 hover:text-red-600 text-xs ml-2">Fjern</button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Add to cart */}
        <button
          onClick={() => withTextConfirm(handleAddToCart)}
          disabled={isDisabled}
          className="w-full bg-primary hover:bg-primary-dark text-secondary font-bold py-3 px-6 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {!canAddToCart
            ? "Ikke på lager"
            : added
            ? "Lagt i kurv ✓"
            : "Læg i kurv"}
        </button>
      </div>
    </div>
    <PrintConfirmDialog
      open={pendingAction !== null}
      onConfirm={() => { pendingAction?.(); setPendingAction(null); }}
      onCancel={() => setPendingAction(null)}
    />
    <GroupOrderConfirmDialog
      open={showGroupOrderDialog}
      deadline={product.groupOrderDeadline ? product.groupOrderDeadline.toISOString() : null}
      onConfirm={() => { setShowGroupOrderDialog(false); doAddToCart(); }}
      onCancel={() => setShowGroupOrderDialog(false)}
    />
    </>
  );
}
