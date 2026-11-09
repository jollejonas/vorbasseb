import type { Prisma } from "@prisma/client";

type Database = Pick<Prisma.TransactionClient, "$queryRaw" | "$executeRaw">;

async function hasVatColumn(db: Database) {
  const rows = await db.$queryRaw<{ installed: boolean }[]>`
    SELECT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'Order' AND column_name = 'vatRate') AS installed`;
  return rows[0]?.installed === true;
}

// Check before using the column: catching a missing-column exception inside a
// PostgreSQL transaction would leave that transaction aborted.
export async function readOrderVatRate(db: Database, orderId: string) {
  if (!await hasVatColumn(db)) return 25;
  const rows = await db.$queryRaw<{ vatRate: number }[]>`SELECT "vatRate" FROM "Order" WHERE id = ${orderId}`;
  return rows[0]?.vatRate ?? 25;
}

export async function storeOrderVatRate(db: Database, orderId: string, rate: number) {
  if (!await hasVatColumn(db)) return;
  await db.$executeRaw`UPDATE "Order" SET "vatRate" = ${rate} WHERE id = ${orderId}`;
}
