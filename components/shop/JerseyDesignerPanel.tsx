"use client";

import { useMemo } from "react";
import { formatPrice, withVat } from "@/lib/utils";
import type { PrintElement } from "./CartProvider";
import type { DesignerZone, DesignerLogo } from "@prisma/client";

type ProductDesignerFields = {
  images: string[];
  designerFrontImageIdx: number | null;
  designerBackImageIdx: number | null;
  designerPrintColor: string | null;
};

const FONT_SIZE_LABELS = { small: "Lille", medium: "Medium", large: "Stor" } as const;

// ─── Canvas (left column) ─────────────────────────────────────────────────────

type ZoneWithFixedLogo = DesignerZone & { fixedLogo: DesignerLogo | null };

type CanvasProps = {
  product: ProductDesignerFields;
  zones: ZoneWithFixedLogo[];
  printElements: PrintElement[];
  previewSide: "front" | "back";
  clickedZoneId: number | null;
  onZoneClick: (zone: ZoneWithFixedLogo) => void;
  toastMsg: string | null;
  readOnly?: boolean;
};

export function JerseyDesignerCanvas({
  product,
  zones,
  printElements,
  previewSide,
  clickedZoneId,
  onZoneClick,
  toastMsg,
  readOnly = false,
}: CanvasProps) {
  const printColor = product.designerPrintColor ?? "#FFFFFF";
  const frontImageIdx = product.designerFrontImageIdx ?? 0;
  const backImageIdx = product.designerBackImageIdx ?? 0;
  const previewImage =
    previewSide === "front" ? product.images[frontImageIdx] : product.images[backImageIdx];

  const visibleZones = zones.filter((z) => z.side === previewSide && !z.fixedLogo);
  const visibleFixedZones = zones.filter((z) => z.side === previewSide && z.fixedLogo);
  const visibleElements = printElements.filter((p) => p.side === previewSide);

  const zoneMap = useMemo(() => {
    const m = new Map<number, ZoneWithFixedLogo>();
    zones.forEach((z) => m.set(z.id, z));
    return m;
  }, [zones]);

  return (
    <div className="space-y-3">
      <div className="relative w-full rounded-xl overflow-hidden bg-gray-50 border border-gray-100">
        {previewImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewImage} alt="Jersey" className="w-full object-contain" />
        ) : (
          <div className="aspect-square flex items-center justify-center text-gray-300 text-sm">
            Intet billede
          </div>
        )}

        {/* Clickable zone rectangles */}
        {!readOnly && visibleZones.map((zone) => {
          const isActive = zone.id === clickedZoneId;
          return (
            <button
              key={zone.id}
              type="button"
              onClick={() => onZoneClick(zone)}
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
            />
          );
        })}

        {/* Print overlays */}
        {visibleElements.map((el, i) => {
          const zone = zoneMap.get(el.zoneId);
          if (!zone) return null;
          const cx = zone.previewX + zone.previewW / 2;
          const cy = zone.previewY + zone.previewH / 2;
          const fontClass =
            el.fontSize === "small"
              ? "text-xs"
              : el.fontSize === "large"
                ? "text-lg font-bold"
                : "text-sm font-semibold";
          return (
            <div
              key={i}
              className="absolute pointer-events-none"
              style={{ left: `${cx}%`, top: `${cy}%`, transform: "translate(-50%, -50%)" }}
            >
              {el.type === "text" ? (
                <span
                  className={`${fontClass} drop-shadow`}
                  style={{ color: printColor, textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}
                >
                  {el.value}
                </span>
              ) : el.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={el.logoUrl}
                  alt={el.zoneLabel}
                  className="h-8 w-auto object-contain drop-shadow"
                />
              ) : null}
            </div>
          );
        })}
        {/* Fixed logo overlays — always rendered, not clickable */}
        {visibleFixedZones.map((z) => (
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

      {!readOnly && visibleZones.length > 0 && !clickedZoneId && (
        <p className="text-xs text-center text-gray-400">Klik på en zone for at tilføje tryk</p>
      )}
      {toastMsg && (
        <p className="text-xs text-center text-green-600 font-medium">{toastMsg}</p>
      )}
    </div>
  );
}

// ─── Controls (right column) ──────────────────────────────────────────────────

type ControlsProps = {
  zones: ZoneWithFixedLogo[];
  logos: DesignerLogo[];
  vatPct?: number;
  printElements: PrintElement[];
  onRemovePrint: (idx: number) => void;
  // Clicked zone state
  clickedZone: ZoneWithFixedLogo | null;
  onClosePanel: () => void;
  addType: "text" | "logo";
  onAddTypeChange: (t: "text" | "logo") => void;
  addText: string;
  onAddTextChange: (v: string) => void;
  addLogoId: number | null;
  onAddLogoIdChange: (id: number | null) => void;
  addFontSize: "small" | "medium" | "large";
  onAddFontSizeChange: (fs: "small" | "medium" | "large") => void;
  onConfirmAdd: () => void;
  // Front/back toggle
  hasBack: boolean;
  previewSide: "front" | "back";
  onPreviewSideChange: (side: "front" | "back") => void;
  // Close designer
  onCloseDesigner: () => void;
};

export function JerseyDesignerControls({
  zones,
  logos,
  vatPct = 25,
  printElements,
  onRemovePrint,
  clickedZone,
  onClosePanel,
  addType,
  onAddTypeChange,
  addText,
  onAddTextChange,
  addLogoId,
  onAddLogoIdChange,
  addFontSize,
  onAddFontSizeChange,
  onConfirmAdd,
  hasBack,
  previewSide,
  onPreviewSideChange,
  onCloseDesigner,
}: ControlsProps) {
  const zoneMap = useMemo(() => {
    const m = new Map<number, ZoneWithFixedLogo>();
    zones.forEach((z) => m.set(z.id, z));
    return m;
  }, [zones]);

  const totalZoneFee = printElements.reduce((sum, el) => {
    const zone = zoneMap.get(el.zoneId);
    return sum + (zone?.price ?? 0);
  }, 0);

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">
          Tryk-designer
          {totalZoneFee > 0 && (
            <span className="ml-2 text-xs font-normal text-gray-500">
              (+{formatPrice(withVat(totalZoneFee, vatPct))})
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={onCloseDesigner}
          className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-gray-400 transition"
        >
          Skjul designer ▲
        </button>
      </div>

      {/* Front/Back toggle */}
      {hasBack && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onPreviewSideChange("front")}
            className={`px-3 py-1 text-sm rounded-lg border transition ${
              previewSide === "front"
                ? "bg-secondary text-white border-secondary"
                : "border-gray-200 text-gray-600 hover:border-gray-400"
            }`}
          >
            Forside
          </button>
          <button
            type="button"
            onClick={() => onPreviewSideChange("back")}
            className={`px-3 py-1 text-sm rounded-lg border transition ${
              previewSide === "back"
                ? "bg-secondary text-white border-secondary"
                : "border-gray-200 text-gray-600 hover:border-gray-400"
            }`}
          >
            Bagside
          </button>
        </div>
      )}

      {/* Zone click panel */}
      {clickedZone ? (
        <div className="border rounded-xl p-4 space-y-4 bg-gray-50">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">
              {clickedZone.label}
              <span className="text-xs text-gray-400 font-normal ml-2">
                {clickedZone.side === "front" ? "Forside" : "Bagside"}
              </span>
              {clickedZone.price > 0 && (
                <span className="text-xs text-gray-400 font-normal ml-2">
                  (+{formatPrice(withVat(clickedZone.price, vatPct))})
                </span>
              )}
            </p>
            <button
              type="button"
              onClick={onClosePanel}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            >
              ×
            </button>
          </div>

          {/* Type toggle */}
          {clickedZone.allowText && clickedZone.allowLogo && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onAddTypeChange("text")}
                className={`px-3 py-1.5 text-sm rounded-lg border transition ${
                  addType === "text"
                    ? "bg-secondary text-white border-secondary"
                    : "border-gray-200 hover:border-gray-400"
                }`}
              >
                Tekst
              </button>
              <button
                type="button"
                onClick={() => onAddTypeChange("logo")}
                className={`px-3 py-1.5 text-sm rounded-lg border transition ${
                  addType === "logo"
                    ? "bg-secondary text-white border-secondary"
                    : "border-gray-200 hover:border-gray-400"
                }`}
              >
                Logo
              </button>
            </div>
          )}

          {/* Text input */}
          {clickedZone.allowText && addType === "text" && (
            <div className="space-y-3">
              <input
                type="text"
                value={addText}
                onChange={(e) => onAddTextChange(e.target.value.toUpperCase())}
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
                    onClick={() => onAddFontSizeChange(fs)}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition ${
                      addFontSize === fs
                        ? "bg-secondary text-white border-secondary"
                        : "border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    {FONT_SIZE_LABELS[fs]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Logo picker */}
          {clickedZone.allowLogo && addType === "logo" &&
            (logos.length === 0 ? (
              <p className="text-xs text-gray-400">Ingen logoer tilgængelige.</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {logos.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => onAddLogoIdChange(l.id)}
                    className={`p-2 rounded-lg border transition ${
                      addLogoId === l.id
                        ? "border-secondary ring-2 ring-secondary/30"
                        : "border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={l.imageUrl} alt={l.name} className="h-12 w-12 object-contain" />
                    <p className="text-xs text-center text-gray-500 mt-1">{l.name}</p>
                  </button>
                ))}
              </div>
            ))}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onConfirmAdd}
              disabled={
                (addType === "text" && !addText.trim()) ||
                (addType === "logo" && addLogoId === null)
              }
              className="bg-secondary text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
            >
              Tilføj
            </button>
            <button
              type="button"
              onClick={onClosePanel}
              className="border border-gray-200 px-4 py-2 rounded-lg text-sm text-gray-600 hover:border-gray-400"
            >
              Annuller
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-400">Klik på en zone i billedet for at tilføje tryk.</p>
      )}

      {/* Prints list */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700">Tryk ({printElements.length})</p>
        {printElements.length === 0 ? (
          <p className="text-sm text-gray-400">Ingen tryk tilføjet endnu.</p>
        ) : (
          printElements.map((el, i) => (
            <div
              key={i}
              className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm"
            >
              <div>
                <span className="font-medium">{el.zoneLabel}</span>
                <span className="text-gray-400 mx-1">·</span>
                <span className="text-gray-500">
                  {el.side === "front" ? "Forside" : "Bagside"}
                </span>
                <span className="text-gray-400 mx-1">·</span>
                {el.type === "text" ? (
                  <span className="font-mono">
                    {el.value}{" "}
                    <span className="text-gray-400">({FONT_SIZE_LABELS[el.fontSize]})</span>
                  </span>
                ) : (
                  <span>Logo</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => onRemovePrint(i)}
                className="text-red-400 hover:text-red-600 text-xs ml-2"
              >
                Fjern
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
