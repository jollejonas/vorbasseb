// Test suite for per-color print placement storage
// Validates that print elements are isolated per color variant

const test_cases = [
  {
    name: "Test 1: Add element to red color - other colors unaffected",
    scenario: {
      colors: ["red", "blue", "green"],
      actions: [
        { action: "add", color: "red", element: { value: "JENSEN", side: "front" } },
      ],
    },
    expected: {
      red: [{ value: "JENSEN", side: "front" }],
      blue: [],
      green: [],
    },
  },
  {
    name: "Test 2: Add element to red, then blue - both isolated",
    scenario: {
      colors: ["red", "blue"],
      actions: [
        { action: "add", color: "red", element: { value: "JENSEN", side: "front" } },
        { action: "add", color: "blue", element: { value: "NUMBER 10", side: "back" } },
      ],
    },
    expected: {
      red: [{ value: "JENSEN", side: "front" }],
      blue: [{ value: "NUMBER 10", side: "back" }],
    },
  },
  {
    name: "Test 3: Add multiple elements to same color",
    scenario: {
      colors: ["red"],
      actions: [
        { action: "add", color: "red", element: { value: "JENSEN", side: "front" } },
        { action: "add", color: "red", element: { value: "10", side: "back" } },
      ],
    },
    expected: {
      red: [
        { value: "JENSEN", side: "front" },
        { value: "10", side: "back" },
      ],
    },
  },
  {
    name: "Test 4: Remove element from one color - other colors unaffected",
    scenario: {
      colors: ["red", "blue"],
      actions: [
        { action: "add", color: "red", element: { value: "JENSEN", side: "front" } },
        { action: "add", color: "blue", element: { value: "NUMBER 10", side: "back" } },
        { action: "remove", color: "red", index: 0 },
      ],
    },
    expected: {
      red: [],
      blue: [{ value: "NUMBER 10", side: "back" }],
    },
  },
  {
    name: "Test 5: Switch to new color with no prior elements",
    scenario: {
      colors: ["red", "blue", "green"],
      actions: [
        { action: "add", color: "red", element: { value: "JENSEN", side: "front" } },
        { action: "switch", color: "blue" },
      ],
    },
    expected: {
      red: [{ value: "JENSEN", side: "front" }],
      blue: [],
      green: [],
    },
  },
];

// Replicate JerseyDesignerSection per-color storage logic
class DesignerState {
  constructor() {
    this.printElementsByColor = {};
    this.currentColor = null;
  }

  getCurrentColorKey() {
    return this.currentColor ?? "_default";
  }

  getPrintElements() {
    const key = this.getCurrentColorKey();
    return this.printElementsByColor[key] ?? [];
  }

  setPrintElements(updater) {
    const key = this.getCurrentColorKey();
    const current = this.printElementsByColor[key] ?? [];
    const next =
      typeof updater === "function" ? updater(current) : updater;
    this.printElementsByColor = { ...this.printElementsByColor, [key]: next };
  }

  addElement(element) {
    this.setPrintElements((prev) => [...prev, element]);
  }

  removeElement(index) {
    this.setPrintElements((prev) => prev.filter((_, i) => i !== index));
  }

  switchColor(colorId) {
    this.currentColor = colorId;
  }

  getAllElements() {
    return this.printElementsByColor;
  }
}

function runTests() {
  console.log("🧪 Designer Per-Color Print Placement Tests\n");
  let passed = 0;
  let failed = 0;

  test_cases.forEach((tc) => {
    const state = new DesignerState();

    // Execute scenario
    tc.scenario.actions.forEach((action) => {
      state.switchColor(action.color);
      if (action.action === "add") {
        state.addElement(action.element);
      } else if (action.action === "remove") {
        state.removeElement(action.index);
      }
    });

    // Verify results
    const actual = state.getAllElements();

    // Normalize for comparison (remove _default keys if empty)
    const expectedNormalized = {};
    Object.keys(tc.expected).forEach((color) => {
      expectedNormalized[color] = tc.expected[color];
    });

    // Compare
    let pass = true;
    Object.keys(expectedNormalized).forEach((color) => {
      const actualElements = actual[color] ?? [];
      const expectedElements = expectedNormalized[color];
      if (JSON.stringify(actualElements) !== JSON.stringify(expectedElements)) {
        pass = false;
      }
    });

    if (pass) {
      console.log(`✅ ${tc.name}`);
      passed++;
    } else {
      console.log(`❌ ${tc.name}`);
      console.log(`   Expected: ${JSON.stringify(expectedNormalized)}`);
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
