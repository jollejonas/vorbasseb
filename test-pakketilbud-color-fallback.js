// Regression tests for pakketilbud color fallback image resolution

function normalizeHex(hex) {
  if (!hex) return "";
  const v = hex.trim().toLowerCase();
  return v.startsWith("#") ? v : `#${v}`;
}

function toValidHex(value) {
  const normalized = normalizeHex(value);
  if (!normalized) return null;
  const clean = normalized.slice(1);
  return /^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(clean) ? normalized : null;
}

function normalizeLabel(value) {
  return value?.trim().toLowerCase() ?? "";
}

const COLOR_ALIAS_MAP = {
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

function normalizeToken(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function tokenizeColorLabel(value) {
  if (!value) return [];
  return value
    .split(/[^A-Za-z0-9]+/)
    .map(normalizeToken)
    .filter(Boolean);
}

function canonicalColorTokens(value) {
  const tokens = tokenizeColorLabel(value).map((token) => COLOR_ALIAS_MAP[token] ?? token);
  return [...new Set(tokens)];
}

function uniqueNormalizedLabels(values) {
  const labels = values.map(normalizeLabel).filter(Boolean);
  return [...new Set(labels)];
}

function getVariantSearchLabels(variant) {
  const labels = [variant.name];
  if (!toValidHex(variant.hex)) labels.push(variant.hex);
  return uniqueNormalizedLabels(labels);
}

function parseHexColor(hex) {
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

function colorDistanceSq(a, b) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

function resolveOptionColorFallbackImages(
  selectedColorValue,
  colorValues,
  colorVariants,
  skus,
  selectedSizeValueId,
) {
  if (!selectedColorValue) return [];

  const variantsWithImages = colorVariants.filter((cv) => cv.images.length > 0);
  if (variantsWithImages.length === 0) return [];

  const selectedColorPosition = colorValues.find((value) => value.id === selectedColorValue.id)?.position ?? null;
  const selectedHex = toValidHex(selectedColorValue.globalColor?.hex);
  const selectedLabels = uniqueNormalizedLabels([
    selectedColorValue.label,
    selectedColorValue.globalColor?.name,
  ]);

  function rankedLinkedVariants(requireSelectedSize) {
    const linkedVariantCounts = new Map();
    for (const sku of skus) {
      if (!sku.colorVariantId) continue;
      if (!sku.optionValues.some((ov) => ov.optionValueId === selectedColorValue.id)) continue;
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
      .filter((entry) => entry.variant !== null)
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.variant.position - b.variant.position;
      });
  }

  function resolveFromRankedVariants(ranked) {
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

  const selectedRgb = parseHexColor(selectedColorValue.globalColor?.hex);
  if (selectedRgb) {
    const rankedByHexDistance = variantsWithImages
      .map((cv) => {
        const variantRgb = parseHexColor(cv.hex);
        return variantRgb
          ? { distanceSq: colorDistanceSq(selectedRgb, variantRgb), variant: cv }
          : null;
      })
      .filter((entry) => entry !== null)
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
  selectedColorValue,
  colorValues,
  productImages,
) {
  if (!selectedColorValue || productImages.length === 0 || colorValues.length === 0) return [];

  const selectedIdx = colorValues.findIndex((value) => value.id === selectedColorValue.id);
  if (selectedIdx < 0) return [];

  if (productImages.length === colorValues.length) {
    return productImages[selectedIdx] ? [productImages[selectedIdx]] : [];
  }

  if (productImages.length % colorValues.length === 0) {
    const imagesPerColor = productImages.length / colorValues.length;
    const start = selectedIdx * imagesPerColor;
    return productImages.slice(start, start + imagesPerColor).filter(Boolean);
  }

  return [];
}

const testCases = [
  {
    name: "Uses selected-size SKU mapping first",
    input: {
      selectedColorValue: { id: "black", label: "Sort", position: 1, images: [], globalColor: { name: "Sort", hex: "#111111" } },
      colorValues: [
        { id: "blue", label: "Bla", position: 0, globalColor: { name: "Bla", hex: "#223D8F" } },
        { id: "black", label: "Sort", position: 1, globalColor: { name: "Sort", hex: "#111111" } },
      ],
      colorVariants: [
        { id: "v-blue", name: "Marine", hex: "#223D8F", images: ["blue-front.jpg"], position: 0 },
        { id: "v-black", name: "Sort", hex: "#111111", images: ["black-front.jpg"], position: 1 },
      ],
      skus: [
        {
          id: "sku-1",
          colorVariantId: "v-blue",
          optionValues: [{ optionValueId: "blue" }, { optionValueId: "m" }],
        },
        {
          id: "sku-2",
          colorVariantId: "v-black",
          optionValues: [{ optionValueId: "black" }, { optionValueId: "m" }],
        },
      ],
      selectedSizeValueId: "m",
    },
    expectedFirstImage: "black-front.jpg",
  },
  {
    name: "Breaks SKU tie by color position",
    input: {
      selectedColorValue: { id: "black", label: "Sort", position: 1, images: [], globalColor: { name: "Sort", hex: null } },
      colorValues: [
        { id: "blue", label: "Bla", position: 0, globalColor: null },
        { id: "black", label: "Sort", position: 1, globalColor: null },
      ],
      colorVariants: [
        { id: "v-blue", name: "Legacy 1", hex: "legacy", images: ["blue-front.jpg"], position: 0 },
        { id: "v-black", name: "Legacy 2", hex: "legacy", images: ["black-front.jpg"], position: 1 },
      ],
      skus: [
        { id: "sku-1", colorVariantId: "v-blue", optionValues: [{ optionValueId: "black" }] },
        { id: "sku-2", colorVariantId: "v-black", optionValues: [{ optionValueId: "black" }] },
      ],
      selectedSizeValueId: undefined,
    },
    expectedFirstImage: "black-front.jpg",
  },
  {
    name: "Uses positional fallback when no other mapping exists",
    input: {
      selectedColorValue: { id: "black", label: "Unknown", position: 1, images: [], globalColor: { name: null, hex: null } },
      colorValues: [
        { id: "blue", label: "Blue", position: 0, globalColor: null },
        { id: "black", label: "Black", position: 1, globalColor: null },
      ],
      colorVariants: [
        { id: "v-blue", name: "Variant A", hex: "x", images: ["blue-front.jpg"], position: 0 },
        { id: "v-black", name: "Variant B", hex: "y", images: ["black-front.jpg"], position: 1 },
      ],
      skus: [],
      selectedSizeValueId: undefined,
    },
    expectedFirstImage: "black-front.jpg",
  },
  {
    name: "Keeps empty fallback when positional choice is ambiguous",
    input: {
      selectedColorValue: { id: "mid", label: "Mid", position: 1, images: [], globalColor: null },
      colorValues: [{ id: "mid", label: "Mid", position: 1, globalColor: null }],
      colorVariants: [
        { id: "v-left", name: "Left", hex: "x", images: ["left.jpg"], position: 0 },
        { id: "v-right", name: "Right", hex: "y", images: ["right.jpg"], position: 2 },
      ],
      skus: [],
      selectedSizeValueId: undefined,
    },
    expectedFirstImage: null,
  },
  {
    name: "Falls back to product image chunks by color position",
    input: {
      selectedColorValue: { id: "black", label: "Sort", position: 1, images: [], globalColor: { name: "Sort", hex: "#000000" } },
      colorValues: [
        { id: "blue", label: "Blå", position: 0, globalColor: { name: "Blå", hex: "#223D8F" } },
        { id: "black", label: "Sort", position: 1, globalColor: { name: "Sort", hex: "#000000" } },
      ],
      colorVariants: [],
      skus: [],
      selectedSizeValueId: undefined,
      productImages: [
        "blue-front.jpg",
        "blue-back.jpg",
        "black-front.jpg",
        "black-back.jpg",
      ],
    },
    expectedFirstImage: "black-front.jpg",
  },
];

let passed = 0;
let failed = 0;
for (const testCase of testCases) {
  const actual = resolveOptionColorFallbackImages(
    testCase.input.selectedColorValue,
    testCase.input.colorValues,
    testCase.input.colorVariants,
    testCase.input.skus,
    testCase.input.selectedSizeValueId,
  );
  const positionalFallback = resolveOptionColorProductImageFallback(
    testCase.input.selectedColorValue,
    testCase.input.colorValues,
    testCase.input.productImages ?? [],
  );
  const finalImages = actual.length > 0 ? actual : positionalFallback;
  const actualFirstImage = finalImages[0] ?? null;
  if (actualFirstImage === testCase.expectedFirstImage) {
    console.log(`[PASS] ${testCase.name}`);
    passed += 1;
  } else {
    console.log(`[FAIL] ${testCase.name}`);
    console.log(`  expected: ${testCase.expectedFirstImage}`);
    console.log(`  actual:   ${actualFirstImage}`);
    failed += 1;
  }
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
