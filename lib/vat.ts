import { prisma } from "@/lib/prisma";

/** Fetch the configured VAT rate (%) from SiteSettings. Defaults to 25. */
export async function getVatRate(): Promise<number> {
  const setting = await prisma.siteSetting.findUnique({ where: { key: "vat_rate" } });
  return parseInt(setting?.value ?? "25", 10);
}
