import type { Prisma } from "@prisma/client";

// Support both the original serial column and the migrated confirmation counter.
// Inspect first: a missing-table exception would abort the PostgreSQL transaction.
export async function allocateOrderNumber(tx: Prisma.TransactionClient, existingNumber?: number | null): Promise<number> {
  const [schema] = await tx.$queryRaw<{ counter: string | null; legacy: boolean }[]>`
    SELECT to_regclass('public."OrderNumberCounter"')::text AS counter,
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
        AND table_name = 'Order' AND column_name = 'orderNumber' AND column_default LIKE 'nextval(%') AS legacy`;
  if (!schema.counter && schema.legacy) {
    if (existingNumber != null) return existingNumber;
    const [row] = await tx.$queryRaw<{ value: bigint }[]>`SELECT nextval(pg_get_serial_sequence('public."Order"', 'orderNumber')) AS value`;
    return Number(row.value);
  }
  if (!schema.counter) throw new Error("Order numbering migration is incomplete");
  const max = await tx.order.aggregate({ _max: { orderNumber: true } });
  const counter = await tx.orderNumberCounter.upsert({
    where: { id: "orders" },
    create: { id: "orders", value: (max._max.orderNumber ?? 0) + 1 },
    update: { value: { increment: 1 } },
  });
  return counter.value;
}
