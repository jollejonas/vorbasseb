CREATE TABLE "OrderDelivery" (
  "orderId" TEXT NOT NULL PRIMARY KEY,
  "carrier" TEXT NOT NULL,
  "productCode" TEXT NOT NULL,
  "pointId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "postcode" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  CONSTRAINT "OrderDelivery_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
