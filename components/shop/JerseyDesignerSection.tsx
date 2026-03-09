"use client";

import { useState, useMemo } from "react";
import { useCart, type PrintElement } from "./CartProvider";
import { formatPrice, withVat } from "@/lib/utils";
import type { Product, SKU, DesignerZone, DesignerLogo, ProductOptionGroup, ProductOptionValue, SKUOptionValue, GlobalColor } from "@prisma/client";

type SkuFull = SKU & { optionValues: { optionValueId: string }[] };
type OptionGroupFull = ProductOptionGroup & { values: (ProductOptionValue & { globalColor: GlobalColor | null; skuValues: SKUOptionValue[] })[] };

type Props = {
  product: Product;
  zones: DesignerZone[];
  logos: DesignerLogo[];
  skus: SkuFull[];
  vatPct?: number;
  optionGroups: OptionGroupFull[];
};

const FONT_SIZE_LABELS = { small: "Lille", medium: "Medium", large: "Stor" } as const;

export function JerseyDesignerSection({ product, zones, logos, skus, vatPct = 25, optionGroups }: Props) {
  const { addItem } = useCart();

  const [previewSide, setPreviewSide] = useState<"front" | "back">("front");
  const [printElements, setPrintElements] = useState<PrintElement[]>([]);

  // Zone clicked to start add flow
  const [clickedZoneId, setClickedZoneId] = useState<number | null>(null);
  const [addType, setAddType] = useState<"text" | "logo">("text");
  const [addText, setAddText] = useState("");
  const [addLogoId, setAddLogoId] = useState<number | null>(null);
  const [addFontSize, setAddFontSize] = useState<"small" | "medium" | "large">("medium");
  const [toast, setToast] = useState<string | null>(null);

  const [selectedSize, setSelectedSize] = useState<string>("");
  const [added, setAdded] = useState(false);

  const sizeGroup = optionGroups.find((g) => g.type === "SIZE");

  const frontImageIdx = product.designerFrontImageIdx ?? 0;
  const backImageIdx = product.designerBackImageIdx ?? 0;
  const previewImage = previewSide === "front"
    ? product.images[frontImageIdx]
    : product.images[backImageIdx];

  const printColor = product.designerPrintColor ?? "#FFFFFF";

  const visibleZones = zones.filter((z) => z.side === previewSide);
  const visibleElements = printElements.filter((p) => p.side === previewSide);

  const zoneMap = useMemo(() => {
    const m = new Map<number, DesignerZone>();
    zones.forEach((z) => m.set(z.id, z));
    return m;
  }, [zones]);

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
    setToast(`Tryk tilføjet til ${label}`);
    setTimeout(() => setToast(null), 2500);
  }

  function removePrint(idx: number) {
    setPrintElements((prev) => prev.filter((_, i) => i !== idx));
  }

  const activeSku = useMemo((): SkuFull | null => {
    if (!sizeGroup) {
      return skus.find((s) => s.stock > 0) ?? skus[0] ?? null;
    }
    const sizeValue = sizeGroup.values.find((v) => v.label === selectedSize);
    if (!sizeValue) return null;
    return skus.find((sku) => {
      const ids = sku.optionValues.map((sv) => sv.optionValueId);
      return ids.includes(sizeValue.id) && sku.stock > 0;
    }) ?? null;
  }, [skus, sizeGroup, selectedSize]);

  function handleAddToCart() {
    if (!activeSku) return;
    addItem({
      skuId: activeSku.id,
      productId: product.id,
      productName: product.name,
      size: selectedSize || activeSku.size || "One Size",
      price: product.price,
      quantity: 1,
      image: product.images[0],
      clubRoleRequired: product.clubRoleRequired ?? null,
      printElements,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  const canAddToCart = activeSku !== null && activeSku.stock > 0;

  return (
    <div className="grid md:grid-cols-[55%_45%] gap-8 items-start">
      {/* LEFT — Jersey preview + add panel */}
      <div className="space-y-4">
      {/* Jersey preview */}
      <div className="space-y-2">
        {product.designerBackImageIdx !== null && (
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
        <div className="relative w-full max-w-xs mx-auto rounded-xl overflow-hidden bg-gray-50 border border-gray-100">
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
        </div>

        {visibleZones.length > 0 && !clickedZoneId && (
          <p className="text-xs text-center text-gray-400">Klik på en zone på trøjen for at tilføje tryk</p>
        )}
        {toast && (
          <p className="text-xs text-center text-green-600 font-medium">{toast}</p>
        )}
      </div>

      {/* Compact add panel — shown when a zone is clicked */}
      {clickedZone && (
        <div className="border rounded-xl p-4 space-y-4 bg-gray-50">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">
              {clickedZone.label}
              <span className="text-xs text-gray-400 font-normal ml-2">
                {clickedZone.side === "front" ? "Forside" : "Bagside"}
              </span>
            </p>
            <button
              type="button"
              onClick={() => setClickedZoneId(null)}
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
              onClick={() => setClickedZoneId(null)}
              className="border border-gray-200 px-4 py-2 rounded-lg text-sm text-gray-600 hover:border-gray-400"
            >
              Annuller
            </button>
          </div>
        </div>
      )}

      </div>{/* end left col */}

      {/* RIGHT — title, description, prints, size, cart */}
      <div className="space-y-5">
        {/* Product info */}
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
          <p className="text-gray-600 leading-relaxed">{product.description}</p>
        </div>

        {/* Added prints list */}
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

      {/* Size selection */}
      {sizeGroup && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Størrelse</label>
          <div className="flex flex-wrap gap-2">
            {sizeGroup.values.map((v) => {
              const sizeSkus = skus.filter((s) => s.optionValues.some((sv) => sv.optionValueId === v.id));
              const inStock = sizeSkus.some((s) => s.stock > 0);
              return (
                <button
                  key={v.id}
                  type="button"
                  disabled={!inStock}
                  onClick={() => setSelectedSize(v.label)}
                  className={`px-4 py-2 text-sm rounded-lg border transition ${
                    selectedSize === v.label
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

      <button
        onClick={handleAddToCart}
        disabled={!canAddToCart || (!!sizeGroup && !selectedSize)}
        className="w-full bg-primary hover:bg-primary-dark text-secondary font-bold py-3 px-6 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {!canAddToCart
          ? "Ikke på lager"
          : added
          ? "Lagt i kurv ✓"
          : "Læg i kurv"}
      </button>
      </div>{/* end right col */}
    </div>
  );
}
