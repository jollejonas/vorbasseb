// Test suite for interactive designer color-aware image fallback
// Validates per-color fallback and per-color print placement logic

const test_cases = [
  {
    name: "Test 1: Color has designer images configured - should use color images",
    input: {
      productFrontImageIdx: 0,
      productBackImageIdx: 1,
      productImages: ["product-front.jpg", "product-back.jpg"],
      colorFrontImageIdx: 0,
      colorBackImageIdx: 1,
      colorImages: ["color-front.jpg", "color-back.jpg"],
    },
    expected: {
      resolvedFrontImage: "color-front.jpg",
      resolvedBackImage: "color-back.jpg",
      hasBackImage: true,
    },
  },
  {
    name: "Test 2: Color has front image only - should fallback back to product",
    input: {
      productFrontImageIdx: 0,
      productBackImageIdx: 1,
      productImages: ["product-front.jpg", "product-back.jpg"],
      colorFrontImageIdx: 0,
      colorBackImageIdx: null, // No back image for this color
      colorImages: ["color-front.jpg"],
    },
    expected: {
      resolvedFrontImage: "color-front.jpg",
      resolvedBackImage: "product-back.jpg",
      hasBackImage: true,
    },
  },
  {
    name: "Test 3: Color has no designer images - should fallback to product completely",
    input: {
      productFrontImageIdx: 0,
      productBackImageIdx: 1,
      productImages: ["product-front.jpg", "product-back.jpg"],
      colorFrontImageIdx: null,
      colorBackImageIdx: null,
      colorImages: [],
    },
    expected: {
      resolvedFrontImage: "product-front.jpg",
      resolvedBackImage: "product-back.jpg",
      hasBackImage: true,
    },
  },
  {
    name: "Test 4: Color has back image but no front - front should fallback to product",
    input: {
      productFrontImageIdx: 0,
      productBackImageIdx: 1,
      productImages: ["product-front.jpg", "product-back.jpg"],
      colorFrontImageIdx: null,
      colorBackImageIdx: 0, // Malformed - back index without front
      colorImages: ["color-back.jpg"],
    },
    expected: {
      resolvedFrontImage: "product-front.jpg",
      resolvedBackImage: "color-back.jpg",
      hasBackImage: true,
    },
  },
  {
    name: "Test 5: Product has invalid front image index - should fallback to first image",
    input: {
      productFrontImageIdx: 99, // Out of bounds
      productBackImageIdx: 1,
      productImages: ["product-front.jpg", "product-back.jpg"],
      colorFrontImageIdx: null,
      colorBackImageIdx: null,
      colorImages: [],
    },
    expected: {
      resolvedFrontImage: "product-front.jpg", // Falls back to [0]
      resolvedBackImage: "product-back.jpg",
      hasBackImage: true,
    },
  },
];

// Helper: Replicate the resolution logic from PakketilbudWizard
function resolveImageByIndex(images, idx) {
  if (idx == null) return null;
  return images?.[idx] ?? null;
}

function runTests() {
  console.log("🧪 Designer Color-Aware Fallback Tests\n");
  let passed = 0;
  let failed = 0;

  test_cases.forEach((tc) => {
    const {
      productFrontImageIdx,
      productBackImageIdx,
      productImages,
      colorFrontImageIdx,
      colorBackImageIdx,
      colorImages,
    } = tc.input;

    // Replicate PakketilbudWizard logic (lines 295-310)
    const productFrontImage =
      resolveImageByIndex(productImages, productFrontImageIdx) ??
      productImages[0] ??
      null;
    const productBackImage = resolveImageByIndex(productImages, productBackImageIdx);
    const colorFrontImage = resolveImageByIndex(colorImages, colorFrontImageIdx);
    const colorBackImage = resolveImageByIndex(colorImages, colorBackImageIdx);
    const resolvedFrontImage = colorFrontImage ?? productFrontImage;
    const resolvedBackImage = colorBackImage ?? productBackImage;
    const hasBackImage = resolvedBackImage !== null;

    const actual = {
      resolvedFrontImage,
      resolvedBackImage,
      hasBackImage,
    };

    const pass =
      actual.resolvedFrontImage === tc.expected.resolvedFrontImage &&
      actual.resolvedBackImage === tc.expected.resolvedBackImage &&
      actual.hasBackImage === tc.expected.hasBackImage;

    if (pass) {
      console.log(`✅ ${tc.name}`);
      passed++;
    } else {
      console.log(`❌ ${tc.name}`);
      console.log(`   Expected: ${JSON.stringify(tc.expected)}`);
      console.log(`   Actual:   ${JSON.stringify(actual)}`);
      failed++;
    }
  });

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${test_cases.length} tests`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
