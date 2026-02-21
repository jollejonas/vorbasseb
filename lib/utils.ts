import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format øre (integer) as Danish kroner: 9900 → "99,00 kr." */
export function formatPrice(ore: number): string {
  return new Intl.NumberFormat("da-DK", {
    style: "currency",
    currency: "DKK",
    minimumFractionDigits: 2,
  }).format(ore / 100);
}

/** Shipping logic: 49 kr flat, free ≥ 499 kr */
export function calcShipping(subtotalOre: number): number {
  return subtotalOre >= 49900 ? 0 : 4900;
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
