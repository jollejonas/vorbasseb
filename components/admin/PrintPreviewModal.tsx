"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { JerseyDesignerCanvas } from "@/components/shop/JerseyDesignerPanel";
import type { PrintElement } from "@/components/shop/CartProvider";
import type { DesignerZone, DesignerLogo } from "@prisma/client";

type ZoneWithFixedLogo = DesignerZone & { fixedLogo: DesignerLogo | null };

type ProductPreviewData = {
  images: string[];
  designerFrontImageIdx: number | null;
  designerBackImageIdx: number | null;
  designerPrintColor: string | null;
  designerZones: ZoneWithFixedLogo[];
};

type Props = {
  label: string;
  printSummary: string;
  product: ProductPreviewData;
  printElements: PrintElement[];
};

export function PrintPreviewModal({ label, printSummary, product, printElements }: Props) {
  const [open, setOpen] = useState(false);
  const hasFront = printElements.some((p) => p.side === "front");
  const hasBack = printElements.some((p) => p.side === "back");
  const [side, setSide] = useState<"front" | "back">(hasBack ? "back" : "front");

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-left text-gray-500 hover:text-secondary hover:underline cursor-pointer"
      >
        {printSummary}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800">{label} — Tryk</h3>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700">
                <X size={18} />
              </button>
            </div>

            {hasFront && hasBack && (
              <div className="flex gap-2 mb-3">
                {(["front", "back"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSide(s)}
                    className={`text-xs px-3 py-1 rounded-full border ${
                      side === s
                        ? "bg-secondary text-white border-secondary"
                        : "text-gray-500 border-gray-300"
                    }`}
                  >
                    {s === "front" ? "Forside" : "Bagside"}
                  </button>
                ))}
              </div>
            )}

            <JerseyDesignerCanvas
              product={product}
              zones={product.designerZones}
              printElements={printElements}
              previewSide={side}
              clickedZoneId={null}
              onZoneClick={() => {}}
              toastMsg={null}
            />
          </div>
        </div>
      )}
    </>
  );
}
