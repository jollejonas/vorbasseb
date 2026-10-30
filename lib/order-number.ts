import type { Prisma } from "@prisma/client";

// Called inside the transaction that confirms an order. The row update serializes
// concurrent payments and rolls back with the order if fulfillment fails.
export async function allocateOrderNumber(tx: Prisma.TransactionClient): Promise<number> {
  const counter = await tx.orderNumberCounter.update({
    where: { id: "orders" }, data: { value: { increment: 1 } },
  });
  return counter.value;
}
