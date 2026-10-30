-- Preserve issued numbers; unfinished checkouts no longer consume the sequence.
CREATE TABLE "OrderNumberCounter" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "value" INTEGER NOT NULL
);
INSERT INTO "OrderNumberCounter" ("id", "value")
SELECT 'orders', COALESCE(MAX("orderNumber"), 0) FROM "Order";
ALTER TABLE "Order" ALTER COLUMN "orderNumber" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "orderNumber" DROP NOT NULL;
UPDATE "Order" SET "orderNumber" = NULL WHERE "status" = 'PENDING';
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");
