import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";

/** Fetch the configured VAT rate (%) from SiteSettings. Defaults to 25. Cached for 1 hour. */
export const getVatRate = unstable_cache(
  async (): Promise<number> => {
    const setting = await prisma.siteSetting.findUnique({ where: { key: "vat_rate" } });
    return parseInt(setting?.value ?? "25", 10);
  },
  ["vat_rate"],
  { revalidate: 3600, tags: ["vat_rate"] },
);
