// Test suite for front/back toggle stability across color switches
// Validates that previewSide state is preserved when switching colors

const test_cases = [
  {
    name: "Test 1: Toggle to back on red, switch to blue with back image - stay on back",
    scenario: {
      colors: [
        {
          id: "red",
          frontImage: "red-front.jpg",
          backImage: "red-back.jpg",
        },
        {
          id: "blue",
          frontImage: "blue-front.jpg",
          backImage: "blue-back.jpg",
        },
      ],
      actions: [
        { action: "selectColor", colorId: "red" },
        { action: "setPreviewSide", side: "back" },
        { action: "selectColor", colorId: "blue" },
      ],
    },
    expected: {
      finalSide: "back", // Should stay on back since blue has back image
      currentColor: "blue",
    },
  },
  {
    name: "Test 2: Toggle to back on red, switch to blue without back - revert to front",
    scenario: {
      colors: [
        {
          id: "red",
          frontImage: "red-front.jpg",
          backImage: "red-back.jpg",
        },
        {
          id: "blue",
          frontImage: "blue-front.jpg",
          backImage: null, // No back image for blue
        },
      ],
      actions: [
        { action: "selectColor", colorId: "red" },
        { action: "setPreviewSide", side: "back" },
        { action: "selectColor", colorId: "blue" },
      ],
    },
    expected: {
      finalSide: "front", // Should revert to front since blue has no back image
      currentColor: "blue",
    },
  },
  {
    name: "Test 3: Stay on front, switch colors - front always available",
    scenario: {
      colors: [
        {
          id: "red",
          frontImage: "red-front.jpg",
          backImage: "red-back.jpg",
        },
        {
          id: "blue",
          frontImage: "blue-front.jpg",
          backImage: null,
        },
      ],
      actions: [
        { action: "selectColor", colorId: "red" },
        { action: "setPreviewSide", side: "front" },
        { action: "selectColor", colorId: "blue" },
      ],
    },
    expected: {
      finalSide: "front", // Should stay on front
      currentColor: "blue",
    },
  },
  {
    name: "Test 4: Back toggle disabled when color has no back image",
    scenario: {
      colors: [
        {
          id: "red",
          frontImage: "red-front.jpg",
          backImage: null, // No back image
        },
      ],
      actions: [
        { action: "selectColor", colorId: "red" },
      ],
    },
    expected: {
      hasBackImage: false,
      canToggleToBack: false,
      finalSide: "front",
    },
  },
];

// Replicate JerseyDesignerSection toggle logic
class DesignerUIState {
  constructor() {
    this.previewSide = "front";
    this.selectedColor = null;
    this.colors = {};
  }

  loadColors(colors) {
    colors.forEach((c) => {
      this.colors[c.id] = c;
    });
  }

  selectColor(colorId) {
    const color = this.colors[colorId];
    if (!color) throw new Error(`Color ${colorId} not found`);

    this.selectedColor = colorId;

    // Validate preview side (lines 331 in JerseyDesignerSection logic)
    const hasBackImage = color.backImage !== null;
    if (this.previewSide === "back" && !hasBackImage) {
      this.previewSide = "front"; // Revert to front if back not available
    }
  }

  setPreviewSide(side) {
    const hasBackImage = this.colors[this.selectedColor]?.backImage !== null;
    if (side === "back" && !hasBackImage) {
      console.warn(`Back image not available for color ${this.selectedColor}`);
      return false;
    }
    this.previewSide = side;
    return true;
  }

  getHasBackImage() {
    return this.colors[this.selectedColor]?.backImage !== null;
  }

  getCanToggleToBack() {
    return this.getHasBackImage();
  }
}

function runTests() {
  console.log("🧪 Designer Front/Back Toggle Stability Tests\n");
  let passed = 0;
  let failed = 0;

  test_cases.forEach((tc) => {
    const state = new DesignerUIState();
    state.loadColors(tc.scenario.colors);

    // Execute scenario
    tc.scenario.actions.forEach((action) => {
      if (action.action === "selectColor") {
        state.selectColor(action.colorId);
      } else if (action.action === "setPreviewSide") {
        state.setPreviewSide(action.side);
      }
    });

    // Verify results
    const actual = {
      finalSide: state.previewSide,
      currentColor: state.selectedColor,
      hasBackImage: state.getHasBackImage(),
      canToggleToBack: state.getCanToggleToBack(),
    };

    const pass =
      (tc.expected.finalSide === undefined || actual.finalSide === tc.expected.finalSide) &&
      (tc.expected.currentColor === undefined || actual.currentColor === tc.expected.currentColor) &&
      (tc.expected.hasBackImage === undefined || actual.hasBackImage === tc.expected.hasBackImage) &&
      (tc.expected.canToggleToBack === undefined || actual.canToggleToBack === tc.expected.canToggleToBack);

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

  console.log(
    `\n📊 Results: ${passed} passed, ${failed} failed out of ${test_cases.length} tests`
  );
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
