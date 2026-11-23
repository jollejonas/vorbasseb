import type { Prisma } from "@prisma/client";

export const activeOrdersWhere: Prisma.OrderWhereInput = {
  orderNumber: { not: null },
  status: { in: ["PAID", "SHIPPED", "AWAITING_PICKUP", "PICKUP_READY", "DELIVERED"] },
  refunded: false,
};
