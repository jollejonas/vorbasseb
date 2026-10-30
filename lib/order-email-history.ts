import { prisma } from "@/lib/prisma";

/** Email history is optional: its availability must never prevent opening an order. */
export async function loadOrderEmailHistory(orderId: string) {
  try {
    const emails = await prisma.orderEmail.findMany({
      where: { orderId }, orderBy: { createdAt: "desc" },
    });
    return { emails, available: true };
  } catch (error) {
    // Log only the error code, never mail content or customer information.
    console.error("Order email history unavailable", { code: (error as { code?: string })?.code ?? "UNKNOWN" });
    return { emails: [], available: false };
  }
}
