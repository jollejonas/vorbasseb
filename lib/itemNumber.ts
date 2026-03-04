/**
 * Generates a varenummer (item number) from product components.
 * Pattern: [modelNumber][colorCode][sizeLabel]
 * Example: modelNumber="2001", colorCode="03", size="M" → "200103M"
 */
export function generateItemNumber(
  modelNumber?: string | null,
  colorCode?: string | null,
  size?: string | null,
): string | null {
  if (!modelNumber) return null;
  const parts = [modelNumber, colorCode ?? "", size ?? ""];
  return parts.join("");
}
