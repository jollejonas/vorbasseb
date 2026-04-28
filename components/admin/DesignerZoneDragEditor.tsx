"use client";

import { useRef, useCallback, useState } from "react";
import type { DesignerZonePlacementMap } from "@/lib/designerZonePlacements";

type ZoneDef = {
  label: string;
  side: string;
  previewX: number;
  previewY: number;
  previewW: number;
  previewH: number;
};

type Props = {
  imageUrl: string;
  zones: ZoneDef[];
  placements: DesignerZonePlacementMap | null;
  onChange: (placements: DesignerZonePlacementMap | null) => void;
  activeSide: "front" | "back";
};

type DragState = {
  zoneIdx: number;
  mode: "move" | "resize-se";
  startMouseX: number;
  startMouseY: number;
  startPlacement: { previewX: number; previewY: number; previewW: number; previewH: number };
};

function clamp(v: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, v));
}

export function DesignerZoneDragEditor({ imageUrl, zones, placements, onChange, activeSide }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);

  const getPlacement = useCallback((idx: number) => {
    const override = placements?.[String(idx)];
    const zone = zones[idx];
    return override ?? { previewX: zone.previewX, previewY: zone.previewY, previewW: zone.previewW, previewH: zone.previewH };
  }, [placements, zones]);

  const commitPlacement = useCallback((idx: number, p: { previewX: number; previewY: number; previewW: number; previewH: number }) => {
    const next: DesignerZonePlacementMap = { ...(placements ?? {}) };
    next[String(idx)] = { previewX: clamp(p.previewX), previewY: clamp(p.previewY), previewW: clamp(p.previewW, 1), previewH: clamp(p.previewH, 1) };
    onChange(next);
  }, [placements, onChange]);

  const resetZone = useCallback((idx: number) => {
    if (!placements) return;
    const next = { ...placements };
    delete next[String(idx)];
    onChange(Object.keys(next).length > 0 ? next : null);
  }, [placements, onChange]);

  const onMouseDown = useCallback((e: React.MouseEvent, zoneIdx: number, mode: "move" | "resize-se") => {
    e.preventDefault();
    e.stopPropagation();
    const p = getPlacement(zoneIdx);
    dragRef.current = {
      zoneIdx,
      mode,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startPlacement: { ...p },
    };
    setDraggingIdx(zoneIdx);

    function onMove(ev: MouseEvent) {
      const drag = dragRef.current;
      if (!drag || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dx = ((ev.clientX - drag.startMouseX) / rect.width) * 100;
      const dy = ((ev.clientY - drag.startMouseY) / rect.height) * 100;
      const sp = drag.startPlacement;

      let next;
      if (drag.mode === "move") {
        next = { ...sp, previewX: sp.previewX + dx, previewY: sp.previewY + dy };
      } else {
        next = { ...sp, previewW: Math.max(2, sp.previewW + dx), previewH: Math.max(2, sp.previewH + dy) };
      }
      commitPlacement(drag.zoneIdx, next);
    }

    function onUp() {
      dragRef.current = null;
      setDraggingIdx(null);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [getPlacement, commitPlacement]);

  const visibleZones = zones.map((z, i) => ({ ...z, idx: i })).filter(z => z.side === activeSide);

  return (
    <div className="space-y-1.5">
      <div
        ref={containerRef}
        className="relative w-full rounded-lg overflow-hidden border border-gray-200 bg-gray-50 select-none"
        style={{ cursor: draggingIdx !== null ? "grabbing" : "default" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="Farve preview" className="w-full object-contain" draggable={false} />

        {visibleZones.map(({ idx }) => {
          const p = getPlacement(idx);
          const zone = zones[idx];
          const isOverride = !!placements?.[String(idx)];
          const isDragging = draggingIdx === idx;

          return (
            <div
              key={idx}
              className="absolute group"
              style={{
                left: `${p.previewX}%`,
                top: `${p.previewY}%`,
                width: `${p.previewW}%`,
                height: `${p.previewH}%`,
                boxSizing: "border-box",
                border: isDragging
                  ? "2px solid rgba(59,130,246,1)"
                  : isOverride
                  ? "2px solid rgba(234,88,12,0.9)"
                  : "1.5px dashed rgba(100,116,139,0.8)",
                background: isDragging
                  ? "rgba(59,130,246,0.15)"
                  : isOverride
                  ? "rgba(234,88,12,0.08)"
                  : "rgba(255,255,255,0.06)",
                borderRadius: "3px",
                cursor: "grab",
              }}
              onMouseDown={(e) => onMouseDown(e, idx, "move")}
            >
              {/* Zone label */}
              <span
                className="absolute top-0.5 left-1 text-[9px] font-semibold leading-none pointer-events-none"
                style={{ color: isOverride ? "rgb(234,88,12)" : "rgba(255,255,255,0.9)", textShadow: "0 1px 2px rgba(0,0,0,0.7)" }}
              >
                {zone.label}
              </span>

              {/* Reset button — top right */}
              {isOverride && (
                <button
                  type="button"
                  className="absolute -top-2 -right-2 w-4 h-4 bg-orange-500 text-white rounded-full text-[9px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); resetZone(idx); }}
                  title="Nulstil zone"
                >
                  ✕
                </button>
              )}

              {/* Resize handle — bottom right corner */}
              <div
                className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize"
                style={{ background: isDragging ? "rgba(59,130,246,0.8)" : "rgba(100,116,139,0.5)", borderTopLeftRadius: "2px" }}
                onMouseDown={(e) => { e.stopPropagation(); onMouseDown(e, idx, "resize-se"); }}
              />
            </div>
          );
        })}
      </div>
      <p className="text-[9px] text-gray-400">
        Træk zone for at flytte · Træk hjørne for at ændre størrelse ·{" "}
        <span className="text-orange-500">Orange</span> = tilpasset for denne farve
      </p>
    </div>
  );
}
