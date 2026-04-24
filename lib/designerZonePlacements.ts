export type DesignerZonePlacement = {
  previewX: number;
  previewY: number;
  previewW: number;
  previewH: number;
};

export type DesignerZonePlacementMap = Record<string, DesignerZonePlacement>;

type ZoneLike = {
  previewX: number;
  previewY: number;
  previewW: number;
  previewH: number;
};

function clampPct(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

export function normalizeDesignerZonePlacements(input: unknown): DesignerZonePlacementMap | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;

  const result: DesignerZonePlacementMap = {};

  for (const [key, raw] of Object.entries(input as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const candidate = raw as Record<string, unknown>;
    const previewX = asFiniteNumber(candidate.previewX);
    const previewY = asFiniteNumber(candidate.previewY);
    const previewW = asFiniteNumber(candidate.previewW);
    const previewH = asFiniteNumber(candidate.previewH);
    if (previewX === null || previewY === null || previewW === null || previewH === null) continue;

    result[key] = {
      previewX: clampPct(previewX),
      previewY: clampPct(previewY),
      previewW: clampPct(previewW),
      previewH: clampPct(previewH),
    };
  }

  return Object.keys(result).length > 0 ? result : null;
}

export function applyDesignerZonePlacements<T extends ZoneLike>(zones: T[], placementsInput: unknown): T[] {
  const placements = normalizeDesignerZonePlacements(placementsInput);
  if (!placements) return zones;

  return zones.map((zone, index) => {
    const placement = placements[String(index)];
    if (!placement) return zone;
    return {
      ...zone,
      previewX: placement.previewX,
      previewY: placement.previewY,
      previewW: placement.previewW,
      previewH: placement.previewH,
    };
  });
}
