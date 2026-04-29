import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { generateItemNumber } from "@/lib/itemNumber";
import { normalizeDesignerZonePlacements } from "@/lib/designerZonePlacements";
import { Prisma } from "@prisma/client";

type OptionValueInput = {
  _key: string;
  label: string;
  position: number;
  globalColorId?: string | null;
  images?: string[];
  imageLabels?: string[];
  price?: number | null;
  costPrice?: number | null;
  designerFrontImageIdx?: number | null;
  designerBackImageIdx?: number | null;
  designerPrintColor?: string | null;
  designerZonePlacements?: unknown | null;
};

type OptionGroupInput = {
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
  colorValueKey?: string;
  sizeValueKey?: string;
  stock: number;
  itemNumber?: string | null;
  itemNumberOverride: boolean;
  costPrice?: number | null;
};

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const category = searchParams.get("category");
  const q = searchParams.get("q");
  const featured = searchParams.get("featured");

  const session = await auth();
  // @ts-expect-error custom field
  const isMember = session?.user?.subscriptionStatus === "ACTIVE";

  const products = await prisma.product.findMany({
    where: {
      published: true,
      ...(category ? { category: { slug: category } } : {}),
      ...(featured === "true" ? { featured: true } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      skus: { include: { optionValues: { include: { optionValue: true } } } },
      category: true,
      colorVariants: { include: { skus: true }, orderBy: { position: "asc" } },
      optionGroups: {
        include: {
          values: {
            include: { globalColor: true },
            orderBy: { position: "asc" },
          },
        },
        orderBy: { position: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    products.map((p) => ({
      ...p,
      _isMemberRequired: p.membersOnly && !isMember,
    })),
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();

    type ColorVariantInput = {
      name: string; hex: string; images: string[]; position?: number;
      skus: { size: string; stock: number; itemNumber?: string | null }[];
    };

    const hasOptionGroups = Array.isArray(body.optionGroups) && body.optionGroups.length > 0;
    const cvInputs: ColorVariantInput[] = body.colorVariants ?? [];
    const hasColorVariants = !hasOptionGroups && cvInputs.length > 0;

    let productId!: string;

    await prisma.$transaction(async (tx) => {
      // Create product (+ global skus if no color variants and no option groups)
      const product = await tx.product.create({
        data: {
          name: body.name,
          slug: body.slug,
          description: body.description,
          categoryId: body.categoryId ?? null,
          price: body.price,
          salePrice: body.salePrice ?? null,
          salePriceStart: body.salePriceStart ? new Date(body.salePriceStart) : null,
          salePriceEnd: body.salePriceEnd ? new Date(body.salePriceEnd) : null,
          modelNumber: body.modelNumber ?? null,
          membersOnly: body.membersOnly ?? false,
          membersEarlyAccess: body.membersEarlyAccess ?? false,
          clubRoleRequired: body.clubRoleRequired ?? null,
          published: body.published ?? true,
          featured: body.featured ?? false,
          images: body.images ?? [],
          designerEnabled: body.designerEnabled ?? false,
          isGroupOrder: body.isGroupOrder ?? false,
          groupOrderDeadline: body.groupOrderDeadline ? new Date(body.groupOrderDeadline) : null,
          skus: (!hasColorVariants && !hasOptionGroups) ? { create: body.skus ?? [] } : undefined,
        },
      });
      productId = product.id;

      // New option group system
      if (hasOptionGroups) {
        const groupInputs = body.optionGroups as OptionGroupInput[];
        const skuMatrixInputs = (body.skuMatrix ?? []) as SkuMatrixEntry[];

        const keyToValueId = new Map<string, string>();
        const valueIdToColorCode = new Map<string, string | null>();
        const valueIdToSizeLabel = new Map<string, string>();

        for (let gi = 0; gi < groupInputs.length; gi++) {
          const g = groupInputs[gi];
          const group = await tx.productOptionGroup.create({
            data: { productId: product.id, type: g.type, label: g.label, position: gi, required: g.required, fee: g.fee ?? null, costFee: g.costFee ?? null, inputType: g.inputType ?? null },
          });

          for (let vi = 0; vi < g.values.length; vi++) {
            const v = g.values[vi];
            const created = await tx.productOptionValue.create({
              data: {
                groupId: group.id,
                label: v.label,
                position: vi,
                globalColorId: v.globalColorId ?? null,
                images: v.images ?? [],
                imageLabels: v.imageLabels ?? [],
                price: v.price ?? null,
                costPrice: v.costPrice ?? null,
                designerFrontImageIdx: v.designerFrontImageIdx ?? null,
                designerBackImageIdx: v.designerBackImageIdx ?? null,
                designerPrintColor: v.designerPrintColor ?? null,
                designerZonePlacements: normalizeDesignerZonePlacements(v.designerZonePlacements) ?? Prisma.DbNull,
              },
            });
            keyToValueId.set(v._key, created.id);

            if (g.type === "COLOR") {
              if (v.globalColorId) {
                const gc = await tx.globalColor.findUnique({ where: { id: v.globalColorId }, select: { code: true } });
                valueIdToColorCode.set(created.id, gc?.code ?? null);
              } else {
                valueIdToColorCode.set(created.id, null);
              }
            }
            if (g.type === "SIZE") {
              valueIdToSizeLabel.set(created.id, v.label);
            }
          }
        }

        // Resolve all SKU data first, then batch-create to avoid N×2 round-trips
        type NewSkuData = { size: string; stock: number; itemNumber: string | null; itemNumberOverride: boolean; costPrice: number | null; colorValueId: string | null; sizeValueId: string | null };
        const skusToCreate: NewSkuData[] = [];
        for (const entry of skuMatrixInputs) {
          const colorValueId = entry.colorValueKey ? (keyToValueId.get(entry.colorValueKey) ?? entry.colorValueKey) : null;
          const sizeValueId = entry.sizeValueKey ? (keyToValueId.get(entry.sizeValueKey) ?? entry.sizeValueKey) : null;
          const sizeLabel = sizeValueId ? (valueIdToSizeLabel.get(sizeValueId) ?? "") : "";

          let itemNumber = entry.itemNumber ?? null;
          if (!entry.itemNumberOverride) {
            const colorCode = colorValueId ? (valueIdToColorCode.get(colorValueId) ?? null) : null;
            itemNumber = generateItemNumber(body.modelNumber, colorCode, sizeLabel);
          }
          skusToCreate.push({ size: sizeLabel, stock: entry.stock, itemNumber, itemNumberOverride: entry.itemNumberOverride, costPrice: entry.costPrice ?? null, colorValueId, sizeValueId });
        }

        if (skusToCreate.length > 0) {
          const createdSkus = await tx.sKU.createManyAndReturn({
            data: skusToCreate.map(({ colorValueId: _c, sizeValueId: _s, ...d }) => ({ productId: product.id, ...d })),
          });

          const allValueLinks = createdSkus.flatMap((sku, i) => {
            const { colorValueId, sizeValueId } = skusToCreate[i];
            return [
              colorValueId ? { skuId: sku.id, optionValueId: colorValueId } : null,
              sizeValueId ? { skuId: sku.id, optionValueId: sizeValueId } : null,
            ].filter(Boolean) as { skuId: string; optionValueId: string }[];
          });

          if (allValueLinks.length > 0) {
            await tx.sKUOptionValue.createMany({ data: allValueLinks });
          }
        }

      // Legacy color variants path
      } else if (hasColorVariants) {
        for (let i = 0; i < cvInputs.length; i++) {
          const cv = cvInputs[i];
          const created = await tx.colorVariant.create({
            data: { productId: product.id, name: cv.name, hex: cv.hex, images: cv.images ?? [], position: cv.position ?? i },
          });
          if (cv.skus?.length) {
            await tx.sKU.createMany({
              data: cv.skus.map((s) => ({
                productId: product.id,
                colorVariantId: created.id,
                size: s.size,
                stock: s.stock,
                itemNumber: s.itemNumber ?? null,
              })),
            });
          }
        }
      }
    }, { timeout: 30000 });

    const result = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        skus: { include: { optionValues: { include: { optionValue: true } } } },
        category: true,
        colorVariants: { include: { skus: true }, orderBy: { position: "asc" } },
        optionGroups: {
          include: { values: { include: { globalColor: true }, orderBy: { position: "asc" } } },
          orderBy: { position: "asc" },
        },
      },
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error("POST /api/products error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
