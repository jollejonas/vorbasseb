/**
 * One-time migration: convert existing prices from incl. VAT to excl. VAT.
 * Assumes current VAT rate is 25% (divide by 1.25).
 *
 * Run with: npx tsx prisma/seed-vat-migration.ts
 *
 * SAFE TO RUN ONCE. Running a second time will divide prices again — do not re-run.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const VAT_FACTOR = 1.25;

  // ── Products ──────────────────────────────────────────────────────────────
  const products = await prisma.product.findMany({
    select: { id: true, price: true, customizationFee: true },
  });

  console.log(`Migrating ${products.length} products...`);
  for (const p of products) {
    await prisma.product.update({
      where: { id: p.id },
      data: {
        price: Math.round(p.price / VAT_FACTOR),
        customizationFee: p.customizationFee
          ? Math.round(p.customizationFee / VAT_FACTOR)
          : null,
      },
    });
  }

  // ── Option group fees ─────────────────────────────────────────────────────
  const groups = await prisma.productOptionGroup.findMany({
    where: { fee: { not: null } },
    select: { id: true, fee: true },
  });

  console.log(`Migrating ${groups.length} option group fees...`);
  for (const g of groups) {
    if (g.fee !== null) {
      await prisma.productOptionGroup.update({
        where: { id: g.id },
        data: { fee: Math.round(g.fee / VAT_FACTOR) },
      });
    }
  }

  // ── Upsert vat_rate setting ───────────────────────────────────────────────
  await prisma.siteSetting.upsert({
    where: { key: "vat_rate" },
    create: { key: "vat_rate", value: "25" },
    update: {},
  });

  console.log("Done. vat_rate setting set to 25.");
  console.log("NOTE: OrderItem.priceAtPurchase records are intentionally left unchanged (historical snapshots).");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
