import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { generateItemNumber } from "@/lib/itemNumber";

type Params = { params: Promise<{ id: string }> };

const PRODUCT_INCLUDE = {
  skus: {
    include: {
      optionValues: { include: { optionValue: { include: { globalColor: true } } } },
    },
    orderBy: { itemNumber: "asc" as const },
  },
  category: true,
  colorVariants: {
    include: { skus: { orderBy: { size: "asc" as const } } },
    orderBy: { position: "asc" as const },
  },
  optionGroups: {
    include: {
      values: { include: { globalColor: true }, orderBy: { position: "asc" as const } },
    },
    orderBy: { position: "asc" as const },
  },
} as const;

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    include: PRODUCT_INCLUDE,
  });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(product);
}

// ─── Types for form body ─────────────────────────────────────────────────────

type OptionValueInput = {
  id?: string;
  _key: string; // stable client-side key (used in skuMatrix references)
  label: string;
  position: number;
  globalColorId?: string | null;
  images?: string[];
};

type OptionGroupInput = {
  id?: string;
  type: "COLOR" | "SIZE" | "TEXT" | "SELECT" | "CUSTOM";
  label: string;
  position: number;
  required: boolean;
  fee?: number | null;
  costFee?: number | null;
  inputType?: string | null;
  values: OptionValueInput[];
};

type SkuMatrixEntry = {
  id?: string;           // existing SKU id if updating
  colorValueKey?: string; // _key of the color ProductOptionValue (undefined if no COLOR group)
  sizeValueKey?: string;  // _key of the size ProductOptionValue (undefined if no SIZE group)
  stock: number;
  itemNumber?: string | null;
  itemNumberOverride: boolean;
  costPrice?: number | null;
};

type SkuInput = { id?: string; size: string; stock: number; itemNumber?: string | null };
type ColorVariantInput = {
  id?: string; name: string; hex: string; images: string[]; position?: number;
  skus: SkuInput[];
};

// ─── PUT ─────────────────────────────────────────────────────────────────────

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  const hasOptionGroups = Array.isArray(body.optionGroups) && body.optionGroups.length > 0;
  const hasColorVariants = !hasOptionGroups && Array.isArray(body.colorVariants) && body.colorVariants.length > 0;

  await prisma.$transaction(async (tx) => {
    // Update core product fields
    await tx.product.update({
      where: { id },
      data: {
        name: body.name,
        slug: body.slug,
        description: body.description,
        categoryId: body.categoryId ?? null,
        price: body.price,
        modelNumber: body.modelNumber ?? null,
        customizationFee: body.customizationFee ?? null,
        membersOnly: body.membersOnly,
        membersEarlyAccess: body.membersEarlyAccess ?? false,
        clubRoleRequired: body.clubRoleRequired ?? null,
        customizationLabel: body.customizationLabel ?? null,
        customizationShowNumber: body.customizationShowNumber ?? true,
        published: body.published,
        featured: body.featured,
        images: body.images,
      },
    });

    // ── New option group system ───────────────────────────────────────────
    if (hasOptionGroups) {
      const groupInputs = body.optionGroups as OptionGroupInput[];
      const skuMatrixInputs = (body.skuMatrix ?? []) as SkuMatrixEntry[];

      // Delete removed groups (cascades values + SKUOptionValues)
      const incomingGroupIds = groupInputs.filter((g) => g.id).map((g) => g.id!);
      await tx.productOptionGroup.deleteMany({
        where: { productId: id, id: { notIn: incomingGroupIds } },
      });

      // Upsert groups + values; build _key → real DB id map
      const keyToValueId = new Map<string, string>();

      for (let gi = 0; gi < groupInputs.length; gi++) {
        const g = groupInputs[gi];

        let groupId: string;
        if (g.id) {
          await tx.productOptionGroup.update({
            where: { id: g.id },
            data: { type: g.type, label: g.label, position: gi, required: g.required, fee: g.fee ?? null, costFee: g.costFee ?? null, inputType: g.inputType ?? null },
          });
          groupId = g.id;
        } else {
          const created = await tx.productOptionGroup.create({
            data: { productId: id, type: g.type, label: g.label, position: gi, required: g.required, fee: g.fee ?? null, costFee: g.costFee ?? null, inputType: g.inputType ?? null },
          });
          groupId = created.id;
        }

        // Delete removed values from this group
        const incomingValueIds = g.values.filter((v) => v.id).map((v) => v.id!);
        await tx.productOptionValue.deleteMany({
          where: { groupId, id: { notIn: incomingValueIds } },
        });

        // Upsert values
        for (let vi = 0; vi < g.values.length; vi++) {
          const v = g.values[vi];
          let valueId: string;

          if (v.id) {
            await tx.productOptionValue.update({
              where: { id: v.id },
              data: {
                label: v.label,
                position: vi,
                globalColorId: v.globalColorId ?? null,
                images: v.images ?? [],
              },
            });
            valueId = v.id;
          } else {
            const created = await tx.productOptionValue.create({
              data: {
                groupId,
                label: v.label,
                position: vi,
                globalColorId: v.globalColorId ?? null,
                images: v.images ?? [],
              },
            });
            valueId = created.id;
          }

          keyToValueId.set(v._key, valueId);
        }
      }

      // Resolve all COLOR+SIZE group value IDs for varenummer generation
      // Fetch globalColor codes for COLOR values
      const colorGroup = groupInputs.find((g) => g.type === "COLOR");
      const sizeGroup = groupInputs.find((g) => g.type === "SIZE");

      // Build maps for varenummer generation: valueId → color code / size label
      const valueIdToColorCode = new Map<string, string | null>();
      const valueIdToSizeLabel = new Map<string, string>();

      if (colorGroup) {
        for (const v of colorGroup.values) {
          const realId = v.id ? v.id : keyToValueId.get(v._key)!;
          if (v.globalColorId) {
            const gc = await tx.globalColor.findUnique({ where: { id: v.globalColorId }, select: { code: true } });
            valueIdToColorCode.set(realId, gc?.code ?? null);
          } else {
            valueIdToColorCode.set(realId, null);
          }
        }
      }

      if (sizeGroup) {
        for (const v of sizeGroup.values) {
          const realId = v.id ? v.id : keyToValueId.get(v._key)!;
          valueIdToSizeLabel.set(realId, v.label);
        }
      }

      // Resolve SKU matrix entries to real value IDs
      const incomingSkuIds = skuMatrixInputs.filter((e) => e.id).map((e) => e.id!);

      // Delete SKUs for this product that are managed by the option system but not in the incoming matrix
      // (SKUs with at least one SKUOptionValue, or all option-system SKUs tracked by id)
      // Simple: delete SKUs with optionValues not in incomingSkuIds, keeping colorVariant SKUs untouched
      const existingOptionSkuIds = (
        await tx.sKU.findMany({
          where: { productId: id, colorVariantId: null, id: { notIn: incomingSkuIds } },
          select: { id: true, optionValues: { select: { optionValueId: true } } },
        })
      )
        .filter((s) => s.optionValues.length > 0)
        .map((s) => s.id);

      if (existingOptionSkuIds.length > 0) {
        await tx.sKU.deleteMany({ where: { id: { in: existingOptionSkuIds } } });
      }

      // Upsert SKUs from matrix
      for (const entry of skuMatrixInputs) {
        const colorValueId = entry.colorValueKey
          ? (entry.colorValueKey.startsWith("val_") || !entry.colorValueKey.startsWith("c")
              ? keyToValueId.get(entry.colorValueKey) ?? entry.colorValueKey
              : entry.colorValueKey)
          : null;
        const sizeValueId = entry.sizeValueKey
          ? (entry.sizeValueKey.startsWith("val_") || !entry.sizeValueKey.startsWith("c")
              ? keyToValueId.get(entry.sizeValueKey) ?? entry.sizeValueKey
              : entry.sizeValueKey)
          : null;

        // Determine size for SKU.size field (denormalized cache)
        const sizeLabel = sizeValueId ? (valueIdToSizeLabel.get(sizeValueId) ?? "") : "";

        // Auto-generate varenummer if not overridden
        let itemNumber = entry.itemNumber ?? null;
        if (!entry.itemNumberOverride) {
          const colorCode = colorValueId ? (valueIdToColorCode.get(colorValueId) ?? null) : null;
          itemNumber = generateItemNumber(body.modelNumber, colorCode, sizeLabel);
        }

        if (entry.id) {
          // Update existing SKU
          await tx.sKU.update({
            where: { id: entry.id },
            data: { stock: entry.stock, itemNumber, itemNumberOverride: entry.itemNumberOverride, size: sizeLabel, costPrice: entry.costPrice ?? null },
          });
        } else {
          // Create new SKU
          const sku = await tx.sKU.create({
            data: {
              productId: id,
              size: sizeLabel,
              stock: entry.stock,
              itemNumber,
              itemNumberOverride: entry.itemNumberOverride,
              costPrice: entry.costPrice ?? null,
            },
          });

          // Create SKUOptionValue joins
          const valueLinks = [
            colorValueId ? { skuId: sku.id, optionValueId: colorValueId } : null,
            sizeValueId ? { skuId: sku.id, optionValueId: sizeValueId } : null,
          ].filter(Boolean) as { skuId: string; optionValueId: string }[];

          if (valueLinks.length > 0) {
            await tx.sKUOptionValue.createMany({ data: valueLinks });
          }
        }
      }

      // Remove any non-option, non-colorVariant global SKUs if we now have option groups
      await tx.sKU.deleteMany({
        where: {
          productId: id,
          colorVariantId: null,
          optionValues: { none: {} },
          // But only if we actually have some option-managed SKUs now
          NOT: { id: { in: incomingSkuIds } },
        },
      });

    // ── Legacy color variant system ─────────────────────────────────────────
    } else if (hasColorVariants) {
      const cvInputs = body.colorVariants as ColorVariantInput[];
      const incomingCvIds = cvInputs.filter((cv) => cv.id).map((cv) => cv.id!);

      await tx.colorVariant.deleteMany({
        where: { productId: id, id: { notIn: incomingCvIds } },
      });

      for (let i = 0; i < cvInputs.length; i++) {
        const cv = cvInputs[i];
        let cvId: string;

        if (cv.id) {
          await tx.colorVariant.update({
            where: { id: cv.id },
            data: { name: cv.name, hex: cv.hex, images: cv.images ?? [], position: i },
          });
          cvId = cv.id;
        } else {
          const created = await tx.colorVariant.create({
            data: { productId: id, name: cv.name, hex: cv.hex, images: cv.images ?? [], position: i },
          });
          cvId = created.id;
        }

        const skuInputs = cv.skus ?? [];
        const existingSkus = skuInputs.filter((s) => s.id);
        const freshSkus = skuInputs.filter((s) => !s.id);
        const incomingSkuIds = existingSkus.map((s) => s.id!);

        await tx.sKU.deleteMany({ where: { colorVariantId: cvId, id: { notIn: incomingSkuIds } } });
        await Promise.all([
          ...existingSkus.map((s) =>
            tx.sKU.update({ where: { id: s.id! }, data: { stock: s.stock, itemNumber: s.itemNumber ?? null } })
          ),
          ...freshSkus.map((s) =>
            tx.sKU.create({ data: { productId: id, colorVariantId: cvId, size: s.size, stock: s.stock, itemNumber: s.itemNumber ?? null } })
          ),
        ]);
      }

      await tx.sKU.deleteMany({ where: { productId: id, colorVariantId: null } });

    // ── Global SKUs (no color/option system) ────────────────────────────────
    } else if (body.skus && Array.isArray(body.skus)) {
      const skuInputs = body.skus as SkuInput[];
      const existing = skuInputs.filter((s) => s.id);
      const fresh = skuInputs.filter((s) => !s.id);
      const incomingIds = existing.map((s) => s.id!);

      await tx.sKU.deleteMany({ where: { productId: id, id: { notIn: incomingIds }, colorVariantId: null } });
      await Promise.all([
        ...existing.map((s) =>
          tx.sKU.update({ where: { id: s.id! }, data: { stock: s.stock, itemNumber: s.itemNumber ?? null } })
        ),
        ...fresh.map((s) =>
          tx.sKU.create({ data: { productId: id, size: s.size, stock: s.stock, itemNumber: s.itemNumber ?? null } })
        ),
      ]);
    }
  });

  const result = await prisma.product.findUnique({
    where: { id },
    include: PRODUCT_INCLUDE,
  });

  return NextResponse.json(result);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await prisma.product.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
