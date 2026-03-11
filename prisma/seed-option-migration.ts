/**
 * One-time migration: converts legacy ColorVariant + SKU data to the new
 * generic ProductOptionGroup / ProductOptionValue / SKUOptionValue system.
 *
 * Run with:
 *   npx tsx prisma/seed-option-migration.ts
 *
 * Safe to run multiple times — skips products that already have option groups.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Map legacy color names to GlobalColor entries (creates if missing)
async function ensureGlobalColor(
  name: string,
  hex: string,
  existingColors: { id: string; name: string; hex: string; code: string }[],
  nextCode: { value: number },
): Promise<string> {
  // Try matching by name first
  const match = existingColors.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (match) return match.id;

  // Create new GlobalColor with next available code
  const code = String(nextCode.value).padStart(2, "0");
  nextCode.value++;

  const created = await prisma.globalColor.create({
    data: { name, hex, code, position: nextCode.value },
  });
  existingColors.push({ id: created.id, name: created.name, hex: created.hex, code: created.code });
  return created.id;
}

async function main() {
  console.log("Starting option group migration...\n");

  // Load existing GlobalColors
  const globalColors = await prisma.globalColor.findMany();
  const nextCode = {
    value: globalColors.length > 0
      ? Math.max(...globalColors.map((c) => parseInt(c.code) || 0)) + 1
      : 1,
  };

  // Find all products that have ColorVariants but no option groups
  const products = await prisma.product.findMany({
    where: {
      colorVariants: { some: {} },
      optionGroups: { none: {} },
    },
    include: {
      colorVariants: {
        include: { skus: { orderBy: { size: "asc" } } },
        orderBy: { position: "asc" },
      },
      skus: {
        where: { colorVariantId: null },
        orderBy: { size: "asc" },
      },
    },
  });

  console.log(`Found ${products.length} products to migrate.\n`);

  for (const product of products) {
    console.log(`Migrating: ${product.name} (${product.id})`);

    await prisma.$transaction(async (tx) => {
      // ── Create COLOR option group ────────────────────────────────────────
      const colorGroupData = await tx.productOptionGroup.create({
        data: {
          productId: product.id,
          type: "COLOR",
          label: "Farve",
          position: 0,
          required: true,
        },
      });

      // ── Collect all unique sizes across all color variants ───────────────
      const allSizes = [...new Set(
        product.colorVariants.flatMap((cv) => cv.skus.map((s) => s.size))
      )];

      // ── Create SIZE option group ──────────────────────────────────────────
      const sizeGroupData = await tx.productOptionGroup.create({
        data: {
          productId: product.id,
          type: "SIZE",
          label: "Størrelse",
          position: 1,
          required: true,
        },
      });

      // ── Create ProductOptionValues for sizes ──────────────────────────────
      const sizeValueMap = new Map<string, string>(); // size label → value id
      for (let si = 0; si < allSizes.length; si++) {
        const sizeLabel = allSizes[si];
        const sv = await tx.productOptionValue.create({
          data: {
            groupId: sizeGroupData.id,
            label: sizeLabel,
            position: si,
          },
        });
        sizeValueMap.set(sizeLabel, sv.id);
      }

      // ── Migrate each ColorVariant → ProductOptionValue (COLOR) ───────────
      for (let ci = 0; ci < product.colorVariants.length; ci++) {
        const cv = product.colorVariants[ci];

        // Ensure GlobalColor exists
        const gcId = await ensureGlobalColor(cv.name, cv.hex, globalColors, nextCode);

        // Create color option value
        const colorValue = await tx.productOptionValue.create({
          data: {
            groupId: colorGroupData.id,
            label: cv.name,
            position: ci,
            globalColorId: gcId,
            images: cv.images,
          },
        });

        // ── Migrate SKUs for this color variant ────────────────────────────
        for (const sku of cv.skus) {
          const sizeValueId = sizeValueMap.get(sku.size);
          if (!sizeValueId) continue;

          // Update existing SKU to remove colorVariantId link and set itemNumberOverride
          await tx.sKU.update({
            where: { id: sku.id },
            data: {
              colorVariantId: null,
              itemNumberOverride: sku.itemNumber ? true : false,
            },
          });

          // Create SKUOptionValue joins
          await tx.sKUOptionValue.createMany({
            data: [
              { skuId: sku.id, optionValueId: colorValue.id },
              { skuId: sku.id, optionValueId: sizeValueId },
            ],
            skipDuplicates: true,
          });
        }
      }

    });

    console.log(`  ✓ Migrated ${product.colorVariants.length} colors, ${[...new Set(product.colorVariants.flatMap((cv) => cv.skus.map((s) => s.size)))].length} sizes`);
  }

  // Also migrate products with global SKUs (no colorVariants) to have a SIZE group
  const productsWithGlobalSkus = await prisma.product.findMany({
    where: {
      colorVariants: { none: {} },
      optionGroups: { none: {} },
      skus: { some: {} },
    },
    include: {
      skus: { orderBy: { size: "asc" } },
    },
  });

  console.log(`\nFound ${productsWithGlobalSkus.length} products with global SKUs to migrate.\n`);

  for (const product of productsWithGlobalSkus) {
    console.log(`Migrating (global SKUs): ${product.name}`);

    await prisma.$transaction(async (tx) => {
      const sizeGroup = await tx.productOptionGroup.create({
        data: {
          productId: product.id,
          type: "SIZE",
          label: "Størrelse",
          position: 0,
          required: true,
        },
      });

      for (let si = 0; si < product.skus.length; si++) {
        const sku = product.skus[si];
        const sv = await tx.productOptionValue.create({
          data: {
            groupId: sizeGroup.id,
            label: sku.size,
            position: si,
          },
        });

        await tx.sKUOptionValue.create({
          data: { skuId: sku.id, optionValueId: sv.id },
        });

        if (sku.itemNumber) {
          await tx.sKU.update({
            where: { id: sku.id },
            data: { itemNumberOverride: true },
          });
        }
      }

    });

    console.log(`  ✓ Migrated ${product.skus.length} sizes`);
  }

  console.log("\nMigration complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
