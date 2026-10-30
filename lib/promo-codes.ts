import { z } from "zod";

export const promoCodeSchema = z.object({
  code: z.string().trim().toUpperCase().min(1).max(100).regex(/^[A-Z0-9]+$/, "Brug kun A–Z og 0–9 i koden. Skriv fx TRAENER i stedet for TRÆNER."),
  type: z.enum(["percent", "fixed"]),
  amount: z.number().finite().positive(),
  productId: z.string().min(1).optional(),
  replacesSale: z.boolean().default(false),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  oneTimePerCustomer: z.boolean().optional(),
  maxUses: z.number().int().positive().optional(),
}).refine(v => v.type !== "percent" || v.amount <= 100, "Procent skal være højst 100.")
  .refine(v => v.type !== "fixed" || (Number.isSafeInteger(Math.round(v.amount * 100)) && Math.round(v.amount * 100) > 0), "Indtast et gyldigt beløb.");

// End of the selected calendar day in Denmark, including summer time.
export function promoExpiry(date: string): number {
  const noon = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(noon.getTime()) || noon.toISOString().slice(0, 10) !== date) throw new Error("Ugyldig udløbsdato.");
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Copenhagen", hour: "2-digit", hourCycle: "h23" }).format(noon));
  return Math.floor(new Date(`${date}T23:59:59Z`).getTime() / 1000) - (hour - 12) * 3600;
}

export function promoError(error: unknown): { error: string; status: number } {
  const e = error as { type?: string; code?: string; param?: string; requestId?: string };
  console.error("Promo code request failed", { type: e?.type, code: e?.code, param: e?.param, requestId: e?.requestId });
  if (e?.type === "StripeAuthenticationError") return { error: "Stripe-nøglen mangler eller er ugyldig. Kontrollér STRIPE_SECRET_KEY i Vercel.", status: 502 };
  if (e?.type === "StripePermissionError") return { error: "Stripe-nøglen mangler tilladelse til rabatkoder eller produkter.", status: 502 };
  if (e?.param === "code") return { error: "Koden er allerede i brug eller har ugyldige tegn. Brug en anden kode med A–Z og 0–9.", status: 400 };
  return { error: "Stripe kunne ikke behandle rabatkoden. Prøv igen, eller kontrollér serverloggen for den konkrete fejl.", status: 502 };
}
