CREATE TABLE "OrderEmail" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "requestKey" TEXT,
  "kind" TEXT NOT NULL,
  "automatic" BOOLEAN NOT NULL,
  "triggeredBy" TEXT,
  "from" TEXT NOT NULL,
  "to" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "html" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "providerId" TEXT,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3),
  CONSTRAINT "OrderEmail_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrderEmail_requestKey_key" ON "OrderEmail"("requestKey");
CREATE INDEX "OrderEmail_orderId_createdAt_idx" ON "OrderEmail"("orderId", "createdAt");
ALTER TABLE "OrderEmail" ADD CONSTRAINT "OrderEmail_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
