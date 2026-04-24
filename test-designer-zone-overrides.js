// Test suite for per-color designer zone placement overrides
// Validates override application and fallback to base zone coordinates

function normalizeDesignerZonePlacements(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const result = {};
  for (const [key, raw] of Object.entries(input)) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const px = Number(raw.previewX);
    const py = Number(raw.previewY);
    const pw = Number(raw.previewW);
    const ph = Number(raw.previewH);
    if (!Number.isFinite(px) || !Number.isFinite(py) || !Number.isFinite(pw) || !Number.isFinite(ph)) continue;
    result[key] = {
      previewX: Math.max(0, Math.min(100, px)),
      previewY: Math.max(0, Math.min(100, py)),
      previewW: Math.max(0, Math.min(100, pw)),
      previewH: Math.max(0, Math.min(100, ph)),
    };
  }
  return Object.keys(result).length ? result : null;
}

function applyDesignerZonePlacements(zones, placementsInput) {
  const placements = normalizeDesignerZonePlacements(placementsInput);
  if (!placements) return zones;
  return zones.map((zone, idx) => {
    const placement = placements[String(idx)];
    if (!placement) return zone;
    return { ...zone, ...placement };
  });
}

const tests = [
  {
    name: "Override only first zone",
    zones: [
      { previewX: 10, previewY: 10, previewW: 20, previewH: 20 },
      { previewX: 30, previewY: 30, previewW: 20, previewH: 20 },
    ],
    placements: {
      "0": { previewX: 15, previewY: 12, previewW: 22, previewH: 18 },
    },
    expected: [
      { previewX: 15, previewY: 12, previewW: 22, previewH: 18 },
      { previewX: 30, previewY: 30, previewW: 20, previewH: 20 },
    ],
  },
  {
    name: "Fallback to base when overrides are null",
    zones: [{ previewX: 11, previewY: 21, previewW: 31, previewH: 41 }],
    placements: null,
    expected: [{ previewX: 11, previewY: 21, previewW: 31, previewH: 41 }],
  },
  {
    name: "Ignore invalid index keys",
    zones: [{ previewX: 5, previewY: 5, previewW: 5, previewH: 5 }],
    placements: {
      bad: { previewX: 70, previewY: 80, previewW: 90, previewH: 10 },
    },
    expected: [{ previewX: 5, previewY: 5, previewW: 5, previewH: 5 }],
  },
  {
    name: "Clamp out-of-range values",
    zones: [{ previewX: 0, previewY: 0, previewW: 10, previewH: 10 }],
    placements: {
      "0": { previewX: -10, previewY: 120, previewW: 300, previewH: -5 },
    },
    expected: [{ previewX: 0, previewY: 100, previewW: 100, previewH: 0 }],
  },
];

let passed = 0;
let failed = 0;

for (const test of tests) {
  const actual = applyDesignerZonePlacements(test.zones, test.placements).map((z) => ({
    previewX: z.previewX,
    previewY: z.previewY,
    previewW: z.previewW,
    previewH: z.previewH,
  }));
  const ok = JSON.stringify(actual) === JSON.stringify(test.expected);
  if (ok) {
    console.log(`[PASS] ${test.name}`);
    passed += 1;
  } else {
    console.log(`[FAIL] ${test.name}`);
    console.log(`   Expected: ${JSON.stringify(test.expected)}`);
    console.log(`   Actual:   ${JSON.stringify(actual)}`);
    failed += 1;
  }
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
