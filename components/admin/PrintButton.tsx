"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="ml-auto text-sm px-4 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors print:hidden"
    >
      🖨 Print / Gem som PDF
    </button>
  );
}
