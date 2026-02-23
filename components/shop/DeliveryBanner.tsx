import { prisma } from "@/lib/prisma";

export async function DeliveryBanner() {
  const setting = await prisma.siteSetting
    .findUnique({ where: { key: "delivery_banner" } })
    .catch(() => null);

  const text = setting?.value?.trim();
  if (!text) return null;

  return (
    <div className="sticky top-16 z-40 bg-primary text-secondary text-xs font-semibold text-center py-1.5 px-4">
      {text}
    </div>
  );
}
