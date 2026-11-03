import { prisma } from '@/lib/prisma';
export async function loadOrderDelivery(orderId: string) {
  try {
    return await prisma.orderDelivery.findUnique({ where: { orderId } });
  } catch (error) {
    // Pre-migration legacy orders must remain readable; other failures are real errors.
    if ((error as { code?: string }).code === 'P2021') return null;
    throw error;
  }
}
