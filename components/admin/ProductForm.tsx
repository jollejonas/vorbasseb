"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { slugify } from "@/lib/utils";
import type { Product, SKU, Category, ClubRole, ColorVariant, ProductOptionGroup, ProductOptionValue, GlobalColor, OptionGroupTemplate, OptionGroupTemplateValue, DesignerZone } from "@prisma/client";
import { X } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type OptionValueWithColor = ProductOptionValue & { globalColor: GlobalColor | null };
type OptionGroupWithValues = ProductOptionGroup & { values: OptionValueWithColor[] };
type ColorVariantWithSkus = ColorVariant & { skus: SKU[] };
type SkuWithOptions = SKU & { optionValues: { optionValueId: string }[] };
type ProductWithRelations = Product & {
  skus: SkuWithOptions[];
  category: Category | null;
  colorVariants: ColorVariantWithSkus[];
  optionGroups: OptionGroupWithValues[];
  designerZones: DesignerZone[];
};

type OptionType = "COLOR" | "SIZE" | "TEXT" | "SELECT" | "CUSTOM";

type OptionValueRow = {
  id?: string;
  _key: string;
  label: string;
  position: number;
  globalColorId?: string | null;
  globalColorHex?: string;
  images: string[];
};

type OptionGroupRow = {
  id?: string;
  _key: string;
  type: OptionType;
  label: string;
  position: number;
  required: boolean;
  feeKr: string;
  costFeeKr: string;
  inputType: string;
  values: OptionValueRow[];
};

type SkuMatrixCell = {
  id?: string;
  colorValueKey: string;
  sizeValueKey: string;
  stock: number;
  itemNumber: string;
  itemNumberOverride: boolean;
  costPriceKr: string;
};

type LegacySkuRow = { id?: string; size: string; stock: number; itemNumber?: string };

type TemplateValueFull = OptionGroupTemplateValue & { globalColor: GlobalColor | null };
type TemplateFull = OptionGroupTemplate & { values: TemplateValueFull[] };
type LegacyColorVariantRow = {
  id?: string; name: string; hex: string; images: string[]; skus: LegacySkuRow[];
};

const ADULT_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const KIDS_SIZES = ["116", "128", "140", "152", "164"];
const ALL_SIZES = [...ADULT_SIZES, ...KIDS_SIZES, "One Size"];

let _keySeq = 0;
function nextKey() { return `k${++_keySeq}`; }

function generatePreviewItemNumber(
  modelNumber: string,
  colorCode: string | null | undefined,
  sizeLabel: string,
): string {
  if (!modelNumber) return "";
  return `${modelNumber}${colorCode ?? ""}${sizeLabel}`;
}

/** Builds both optionGroups and skuMatrix with a shared key sequence so keys are consistent. */
function buildInitialProductState(product: ProductWithRelations | undefined): {
  optionGroups: OptionGroupRow[];
  skuMatrix: SkuMatrixCell[];
} {
  if (!product?.optionGroups.length) return { optionGroups: [], skuMatrix: [] };

  const valueIdToKey = new Map<string, string>();
  const optionGroups: OptionGroupRow[] = product.optionGroups.map((g) => ({
    id: g.id,
    _key: nextKey(),
    type: g.type as OptionType,
    label: g.label,
    position: g.position,
    required: g.required,
    feeKr: g.fee ? (g.fee / 100).toFixed(2) : "",
    costFeeKr: g.costFee ? (g.costFee / 100).toFixed(2) : "",
    inputType: g.inputType ?? "",
    values: g.values.map((v) => {
      const key = nextKey();
      if (v.id) valueIdToKey.set(v.id, key);
      return {
        id: v.id,
        _key: key,
        label: v.label,
        position: v.position,
        globalColorId: v.globalColorId,
        globalColorHex: v.globalColor?.hex,
        images: v.images,
      };
    }),
  }));

  const colorGroup = optionGroups.find((g) => g.type === "COLOR");
  const sizeGroup = optionGroups.find((g) => g.type === "SIZE");

  // Pre-fill the full grid so every cell is always editable (even without SKUOptionValue records)
  const skuMatrix: SkuMatrixCell[] = [];
  if (colorGroup && sizeGroup) {
    for (const cv of colorGroup.values) {
      for (const sv of sizeGroup.values) {
        skuMatrix.push({ colorValueKey: cv._key, sizeValueKey: sv._key, stock: 0, itemNumber: "", itemNumberOverride: false, costPriceKr: "" });
      }
    }
  } else if (sizeGroup) {
    for (const sv of sizeGroup.values) {
      skuMatrix.push({ colorValueKey: "", sizeValueKey: sv._key, stock: 0, itemNumber: "", itemNumberOverride: false, costPriceKr: "" });
    }
  }

  // Overlay actual SKU data on matching cells (matched via SKUOptionValue links)
  for (const sku of product.skus) {
    if ((sku as SKU & { colorVariantId?: string | null }).colorVariantId) continue;
    const optionValueIds = sku.optionValues.map((ov) => ov.optionValueId);

    let colorValueKey = "";
    let sizeValueKey = "";
    if (colorGroup) {
      const cv = colorGroup.values.find((v) => v.id && optionValueIds.includes(v.id));
      colorValueKey = cv?._key ?? "";
    }
    if (sizeGroup) {
      const sv = sizeGroup.values.find((v) => v.id && optionValueIds.includes(v.id));
      sizeValueKey = sv?._key ?? "";
    }
    const idx = skuMatrix.findIndex((c) => c.colorValueKey === colorValueKey && c.sizeValueKey === sizeValueKey);
    if (idx !== -1) {
      skuMatrix[idx] = {
        id: sku.id,
        colorValueKey,
        sizeValueKey,
        stock: sku.stock,
        itemNumber: sku.itemNumber ?? "",
        itemNumberOverride: sku.itemNumberOverride,
        costPriceKr: sku.costPrice ? (sku.costPrice / 100).toFixed(2) : "",
      };
    }
  }

  return { optionGroups, skuMatrix };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProductForm({ product }: { product?: ProductWithRelations }) {
  const router = useRouter();
  const isEdit = !!product;

  // Determine which mode to start in
  const hasOptionGroups = (product?.optionGroups.length ?? 0) > 0;
  const hasLegacyColors = !hasOptionGroups && (product?.colorVariants.length ?? 0) > 0;

  // ── Basic fields ────────────────────────────────────────────────────────────
  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [slugManual, setSlugManual] = useState(isEdit);
  const [categoryId, setCategoryId] = useState<string>(product?.categoryId ?? "");
  const [categories, setCategories] = useState<Category[]>([]);
  const [priceKr, setPriceKr] = useState(product ? (product.price / 100).toFixed(2) : "");
  const [modelNumber, setModelNumber] = useState(product?.modelNumber ?? "");
  const [membersOnly, setMembersOnly] = useState(product?.membersOnly ?? false);
  const [membersEarlyAccess, setMembersEarlyAccess] = useState(product?.membersEarlyAccess ?? false);
  const [clubRoleRequired, setClubRoleRequired] = useState<ClubRole | "">(product?.clubRoleRequired ?? "");
  const [published, setPublished] = useState(product?.published ?? true);
  const [featured, setFeatured] = useState(product?.featured ?? false);
  const [description, setDescription] = useState(product?.description ?? "");
  const [images, setImages] = useState<string[]>(product?.images ?? []);
  const [saving, setSaving] = useState(false);

  // ── Jersey designer ─────────────────────────────────────────────────────────
  const [designerEnabled, setDesignerEnabled] = useState(product?.designerEnabled ?? false);
  const [designerFrontImageIdx, setDesignerFrontImageIdx] = useState<number | "">(
    product?.designerFrontImageIdx ?? ""
  );
  const [designerBackImageIdx, setDesignerBackImageIdx] = useState<number | "">(
    product?.designerBackImageIdx ?? ""
  );
  const [designerPrintColor, setDesignerPrintColor] = useState(product?.designerPrintColor ?? "#FFFFFF");
  type ZoneRow = {
    side: "front" | "back";
    label: string;
    position: string;
    allowText: boolean;
    allowLogo: boolean;
    previewX: number;
    previewY: number;
    previewW: number;
    previewH: number;
    priceKr: string;
  };

  const [designerZones, setDesignerZones] = useState<ZoneRow[]>(
    (product?.designerZones ?? []).map((z) => ({
      side: z.side as "front" | "back",
      label: z.label,
      position: z.position,
      allowText: z.allowText,
      allowLogo: z.allowLogo,
      previewX: z.previewX,
      previewY: z.previewY,
      previewW: z.previewW,
      previewH: z.previewH,
      priceKr: (z as typeof z & { price?: number }).price ? ((z as typeof z & { price?: number }).price! / 100).toFixed(2) : "",
    }))
  );
  const [designerSaving, setDesignerSaving] = useState(false);
  // Zone editor state
  const [zoneEditorSide, setZoneEditorSide] = useState<"front" | "back">("front");
  const [selectedZoneIdx, setSelectedZoneIdx] = useState<number | null>(null);
  const [drawRect, setDrawRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [pendingArea, setPendingArea] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const drawStart = useRef<{ x: number; y: number } | null>(null);
  const zoneEditorRef = useRef<HTMLDivElement>(null);

  async function saveDesigner() {
    if (!isEdit) return;
    setDesignerSaving(true);
    try {
      const res = await fetch(`/api/products/${product.id}/designer`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          designerEnabled,
          designerFrontImageIdx: designerFrontImageIdx === "" ? null : designerFrontImageIdx,
          designerBackImageIdx: designerBackImageIdx === "" ? null : designerBackImageIdx,
          designerPrintColor: designerPrintColor || null,
          zones: designerZones.map((z, i) => ({
            ...z,
            positionOrd: i,
            price: z.priceKr ? Math.round(parseFloat(z.priceKr) * 100) : 0,
          })),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Fejl");
      toast.success("Designer-opsætning gemt");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Noget gik galt");
    } finally {
      setDesignerSaving(false);
    }
  }

  // ── New option groups system ────────────────────────────────────────────────
  // New products always start in option groups mode; existing products follow their data
  const [useOptionGroups, setUseOptionGroups] = useState(true);
  // Tracks when admin has clicked "Konverter" on a legacy product
  const [migratedToOptions, setMigratedToOptions] = useState(false);
  const [globalColors, setGlobalColors] = useState<GlobalColor[]>([]);

  // ── Template library panel ──────────────────────────────────────────────────
  const [libraryTemplates, setLibraryTemplates] = useState<TemplateFull[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [inlineExpandedType, setInlineExpandedType] = useState<OptionType | null>(null);
  const [inlineFilterTag, setInlineFilterTag] = useState<string | null>(null);

  // Build option groups and SKU matrix together using a shared key sequence
  // so that colorValueKey/sizeValueKey in matrix cells match the _key in optionGroups.
  const _initialState = useRef(buildInitialProductState(product));
  const [optionGroups, setOptionGroups] = useState<OptionGroupRow[]>(_initialState.current.optionGroups);
  const [skuMatrix, setSkuMatrix] = useState<SkuMatrixCell[]>(_initialState.current.skuMatrix);

  // ── Legacy color variant system ─────────────────────────────────────────────
  const [legacySkus, setLegacySkus] = useState<LegacySkuRow[]>(
    product?.skus
      .filter((s) => !s.colorVariantId)
      .map((s) => ({ id: s.id, size: s.size, stock: s.stock, itemNumber: s.itemNumber ?? "" })) ?? []
  );
  const [legacyColorVariants, setLegacyColorVariants] = useState<LegacyColorVariantRow[]>(
    product?.colorVariants.map((cv) => ({
      id: cv.id,
      name: cv.name,
      hex: cv.hex,
      images: cv.images,
      skus: cv.skus.map((s) => ({ id: s.id, size: s.size, stock: s.stock, itemNumber: s.itemNumber ?? "" })),
    })) ?? []
  );

  // ── Cloudinary ──────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const widgetRef = useRef<any>(null);
  const uploadTarget = useRef<"main" | { type: "colorValue"; key: string } | { type: "legacyColor"; idx: number }>("main");

  // ── Effects ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!slugManual) setSlug(slugify(name));
  }, [name, slugManual]);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data: Category[]) => {
        setCategories(data);
        if (!categoryId && data.length > 0) setCategoryId(data[0].id);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (useOptionGroups) {
      fetch("/api/admin/global-colors")
        .then((r) => r.json())
        .then(setGlobalColors)
        .catch(() => {});
    }
  }, [useOptionGroups]);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://upload-widget.cloudinary.com/global/all.js";
    script.async = true;
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

  // ── Cloudinary upload ────────────────────────────────────────────────────────

  function openCloudinaryWidget(target: typeof uploadTarget.current) {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_UPLOAD_PRESET;
    if (!cloudName || !uploadPreset) {
      toast.error("Cloudinary er ikke konfigureret");
      return;
    }
    uploadTarget.current = target;
    if (!widgetRef.current) {
      // @ts-expect-error cloudinary global
      widgetRef.current = window.cloudinary?.createUploadWidget(
        { cloudName, uploadPreset, multiple: true, resourceType: "image", folder: "vbk-produkter", clientAllowedFormats: ["jpg", "jpeg", "png", "webp"], maxFileSize: 5000000 },
        (error: unknown, result: { event: string; info: { secure_url: string } }) => {
          if (error) { toast.error("Upload fejlede"); return; }
          if (result.event === "success") {
            const url = result.info.secure_url;
            const t = uploadTarget.current;
            if (t === "main") {
              setImages((prev) => [...prev, url]);
            } else if (typeof t === "object" && t.type === "colorValue") {
              const { key } = t;
              setOptionGroups((prev) =>
                prev.map((g) => g.type !== "COLOR" ? g : {
                  ...g,
                  values: g.values.map((v) => v._key !== key ? v : { ...v, images: [...v.images, url] }),
                })
              );
            } else if (typeof t === "object" && t.type === "legacyColor") {
              const idx = t.idx;
              setLegacyColorVariants((prev) =>
                prev.map((cv, i) => i === idx ? { ...cv, images: [...cv.images, url] } : cv)
              );
            }
          }
        }
      );
    }
    widgetRef.current?.open();
  }

  // ── Option group helpers ─────────────────────────────────────────────────────

  function addOptionGroup(type: OptionType) {
    const labels: Record<OptionType, string> = {
      COLOR: "Farve", SIZE: "Størrelse", TEXT: "Tryk / navn", SELECT: "Tilvalg", CUSTOM: "Tilpasset"
    };
    setOptionGroups((prev) => [...prev, {
      _key: nextKey(), type, label: labels[type], position: prev.length,
      required: type === "SIZE", feeKr: "", costFeeKr: "", inputType: "text", values: [],
    }]);
  }

  function removeOptionGroup(key: string) {
    setOptionGroups((prev) => prev.filter((g) => g._key !== key));
    // Clean up matrix entries for this group
    setSkuMatrix([]);
  }

  function updateOptionGroup(key: string, patch: Partial<OptionGroupRow>) {
    setOptionGroups((prev) => prev.map((g) => g._key !== key ? g : { ...g, ...patch }));
  }

  function addOptionValue(groupKey: string, value: Omit<OptionValueRow, "_key" | "images">) {
    const valueKey = nextKey();
    setOptionGroups((prev) =>
      prev.map((g) => g._key !== groupKey ? g : {
        ...g, values: [...g.values, { ...value, _key: valueKey, images: [] }],
      })
    );
    return valueKey;
  }

  function removeOptionValue(groupKey: string, valueKey: string, type: OptionType) {
    setOptionGroups((prev) =>
      prev.map((g) => g._key !== groupKey ? g : {
        ...g, values: g.values.filter((v) => v._key !== valueKey),
      })
    );
    // Remove affected matrix cells
    if (type === "COLOR") {
      setSkuMatrix((prev) => prev.filter((c) => c.colorValueKey !== valueKey));
    } else if (type === "SIZE") {
      setSkuMatrix((prev) => prev.filter((c) => c.sizeValueKey !== valueKey));
    }
  }

  function updateOptionValue(groupKey: string, valueKey: string, patch: Partial<OptionValueRow>) {
    setOptionGroups((prev) =>
      prev.map((g) => g._key !== groupKey ? g : {
        ...g, values: g.values.map((v) => v._key !== valueKey ? v : { ...v, ...patch }),
      })
    );
  }

  // When a color or size value is added, expand the SKU matrix
  const expandMatrix = useCallback((
    colorValues: OptionValueRow[],
    sizeValues: OptionValueRow[],
    newColorKey?: string,
    newSizeKey?: string,
  ) => {
    setSkuMatrix((prev) => {
      const next = [...prev];
      if (newColorKey) {
        // Add rows for new color × all existing sizes
        for (const sv of sizeValues) {
          if (!next.find((c) => c.colorValueKey === newColorKey && c.sizeValueKey === sv._key)) {
            next.push({ colorValueKey: newColorKey, sizeValueKey: sv._key, stock: 0, itemNumber: "", itemNumberOverride: false, costPriceKr: "" });
          }
        }
      }
      if (newSizeKey) {
        // Add columns for new size × all existing colors
        for (const cv of colorValues) {
          if (!next.find((c) => c.colorValueKey === cv._key && c.sizeValueKey === newSizeKey)) {
            next.push({ colorValueKey: cv._key, sizeValueKey: newSizeKey, stock: 0, itemNumber: "", itemNumberOverride: false, costPriceKr: "" });
          }
        }
      }
      return next;
    });
  }, []);

  function updateMatrixCell(colorKey: string, sizeKey: string, patch: Partial<SkuMatrixCell>) {
    setSkuMatrix((prev) =>
      prev.map((c) => c.colorValueKey !== colorKey || c.sizeValueKey !== sizeKey ? c : { ...c, ...patch })
    );
  }

  // ── Template library helpers ─────────────────────────────────────────────────

  function toggleInlineType(type: OptionType) {
    if (inlineExpandedType === type) {
      setInlineExpandedType(null);
      setInlineFilterTag(null);
      return;
    }
    setInlineExpandedType(type);
    setInlineFilterTag(null);
    if (libraryTemplates.length === 0) {
      setLibraryLoading(true);
      fetch("/api/admin/option-templates")
        .then((r) => r.json())
        .then((data: TemplateFull[]) => setLibraryTemplates(data))
        .catch(() => {})
        .finally(() => setLibraryLoading(false));
    }
  }

  function applyTemplate(tpl: TemplateFull) {
    const groupKey = nextKey();
    const values: OptionValueRow[] = tpl.values.map((v) => ({
      _key: nextKey(),
      label: v.label,
      position: v.position,
      globalColorId: v.globalColorId ?? null,
      globalColorHex: v.globalColor?.hex,
      images: v.images,
    }));
    const newGroup: OptionGroupRow = {
      _key: groupKey,
      type: tpl.type as OptionType,
      label: tpl.name,
      position: optionGroups.length,
      required: tpl.required,
      feeKr: tpl.fee ? String(Math.round(tpl.fee / 100)) : "",
      costFeeKr: "",
      inputType: tpl.inputType ?? "text",
      values,
    };

    setOptionGroups((prev) => [...prev, newGroup]);

    // Expand SKU matrix if COLOR or SIZE
    if (tpl.type === "COLOR") {
      const sizeGrp = optionGroups.find((g) => g.type === "SIZE");
      if (sizeGrp) {
        setSkuMatrix((prev) => {
          const next = [...prev];
          for (const cv of values) {
            for (const sv of sizeGrp.values) {
              if (!next.find((c) => c.colorValueKey === cv._key && c.sizeValueKey === sv._key)) {
                next.push({ colorValueKey: cv._key, sizeValueKey: sv._key, stock: 0, itemNumber: "", itemNumberOverride: false, costPriceKr: "" });
              }
            }
          }
          return next;
        });
      }
    } else if (tpl.type === "SIZE") {
      const colorGrp = optionGroups.find((g) => g.type === "COLOR");
      if (colorGrp) {
        setSkuMatrix((prev) => {
          const next = [...prev];
          for (const sv of values) {
            for (const cv of colorGrp.values) {
              if (!next.find((c) => c.colorValueKey === cv._key && c.sizeValueKey === sv._key)) {
                next.push({ colorValueKey: cv._key, sizeValueKey: sv._key, stock: 0, itemNumber: "", itemNumberOverride: false, costPriceKr: "" });
              }
            }
          }
          return next;
        });
      }
    }

    setInlineExpandedType(null);
    setInlineFilterTag(null);
  }

  // ── Legacy helpers ────────────────────────────────────────────────────────────

  function addLegacySize(size: string) {
    if (legacySkus.find((s) => s.size === size)) return;
    setLegacySkus((prev) => [...prev, { size, stock: 0, itemNumber: "" }]);
  }
  function removeLegacySize(size: string) { setLegacySkus((prev) => prev.filter((s) => s.size !== size)); }
  function updateLegacySku(size: string, patch: Partial<LegacySkuRow>) {
    setLegacySkus((prev) => prev.map((s) => s.size === size ? { ...s, ...patch } : s));
  }
  function addLegacyColorVariant() {
    setLegacyColorVariants((prev) => [...prev, { name: "", hex: "#000000", images: [], skus: [] }]);
  }
  function removeLegacyColorVariant(idx: number) {
    setLegacyColorVariants((prev) => prev.filter((_, i) => i !== idx));
  }
  function updateLegacyColorVariant(idx: number, patch: Partial<LegacyColorVariantRow>) {
    setLegacyColorVariants((prev) => prev.map((cv, i) => i === idx ? { ...cv, ...patch } : cv));
  }
  function addLegacyColorSize(cvIdx: number, size: string) {
    setLegacyColorVariants((prev) =>
      prev.map((cv, i) => {
        if (i !== cvIdx || cv.skus.find((s) => s.size === size)) return cv;
        return { ...cv, skus: [...cv.skus, { size, stock: 0, itemNumber: "" }] };
      })
    );
  }
  function updateLegacyColorSku(cvIdx: number, size: string, patch: Partial<LegacySkuRow>) {
    setLegacyColorVariants((prev) =>
      prev.map((cv, i) => i !== cvIdx ? cv : { ...cv, skus: cv.skus.map((s) => s.size === size ? { ...s, ...patch } : s) })
    );
  }
  function removeLegacyColorSize(cvIdx: number, size: string) {
    setLegacyColorVariants((prev) =>
      prev.map((cv, i) => i !== cvIdx ? cv : { ...cv, skus: cv.skus.filter((s) => s.size !== size) })
    );
  }

  // ── Submit ────────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const priceVal = parseFloat(priceKr);
    if (isNaN(priceVal) || priceVal < 0) { toast.error("Ugyldig pris"); return; }
    setSaving(true);

    try {
      let payload: Record<string, unknown>;

      if (useOptionGroups) {
        const groupsPayload = optionGroups.map((g, gi) => ({
          id: g.id,
          _key: g._key,
          type: g.type,
          label: g.label,
          position: gi,
          required: g.required,
          fee: g.feeKr ? Math.round(parseFloat(g.feeKr) * 100) : null,
          costFee: g.costFeeKr ? Math.round(parseFloat(g.costFeeKr) * 100) : null,
          inputType: g.inputType || null,
          values: g.values.map((v, vi) => ({
            id: v.id,
            _key: v._key,
            label: v.label,
            position: vi,
            globalColorId: v.globalColorId ?? null,
            images: v.images,
          })),
        }));

        const matrixPayload = skuMatrix.map((cell) => ({
          id: cell.id,
          colorValueKey: cell.colorValueKey,
          sizeValueKey: cell.sizeValueKey,
          stock: cell.stock,
          itemNumber: cell.itemNumberOverride ? (cell.itemNumber || null) : null,
          itemNumberOverride: cell.itemNumberOverride,
          costPrice: cell.costPriceKr ? Math.round(parseFloat(cell.costPriceKr) * 100) : null,
        }));

        payload = {
          name, slug, categoryId: categoryId || null, price: Math.round(priceVal * 100),
          modelNumber: modelNumber || null, description, images,
          membersOnly, membersEarlyAccess, clubRoleRequired: clubRoleRequired || null,
          published, featured, designerEnabled,
          optionGroups: groupsPayload,
          skuMatrix: matrixPayload,
          clearColorVariants: migratedToOptions,
        };
      } else {
        // Legacy path
        payload = {
          name, slug, categoryId: categoryId || null, price: Math.round(priceVal * 100),
          modelNumber: modelNumber || null, description, images,
          membersOnly, membersEarlyAccess, clubRoleRequired: clubRoleRequired || null,
          published, featured, designerEnabled,
          skus: legacyColorVariants.length === 0
            ? legacySkus.map(({ id, size, stock, itemNumber }) => ({ id, size, stock, itemNumber: itemNumber || null }))
            : [],
          colorVariants: legacyColorVariants.map(({ id, name: n, hex, images: imgs, skus: ss }, i) => ({
            id, name: n, hex, images: imgs, position: i,
            skus: ss.map(({ id: sid, size, stock, itemNumber }) => ({ id: sid, size, stock, itemNumber: itemNumber || null })),
          })),
        };
      }

      const url = isEdit ? `/api/products/${product.id}` : "/api/products";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Ukendt fejl");
      }

      toast.success(isEdit ? "Produkt opdateret" : "Produkt oprettet");
      router.push("/admin/produkter");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Noget gik galt");
    } finally {
      setSaving(false);
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────────────

  const colorGroup = optionGroups.find((g) => g.type === "COLOR");
  const sizeGroup = optionGroups.find((g) => g.type === "SIZE");
  const hasMatrix = !!colorGroup && !!sizeGroup && colorGroup.values.length > 0 && sizeGroup.values.length > 0;

  // ── Render ─────────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-3xl">

      {/* ── Basic info ─────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Navn <span className="text-red-500">*</span>
            </label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
              placeholder="f.eks. Spillertrøje 2025"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Modelnummer <span className="text-gray-400 font-normal">(til varenummer)</span>
            </label>
            <input type="text" value={modelNumber} onChange={(e) => setModelNumber(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-secondary"
              placeholder="f.eks. 2001"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Slug <span className="text-red-500">*</span>
          </label>
          <input type="text" value={slug}
            onChange={(e) => { setSlug(e.target.value); setSlugManual(true); }}
            required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary font-mono"
          />
          <p className="text-xs text-gray-400 mt-1">URL: /butik/{slug || "..."}</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
            >
              <option value="">Ingen kategori</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pris (kr, ekskl. moms) <span className="text-red-500">*</span>
            </label>
            <input type="number" min="0" step="0.01" value={priceKr} onChange={(e) => setPriceKr(e.target.value)} required
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
              placeholder="299.00"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Kræver klubrolle</label>
          <select value={clubRoleRequired} onChange={(e) => setClubRoleRequired(e.target.value as ClubRole | "")}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
          >
            <option value="">Ingen begrænsning</option>
            <option value="PLAYER">Kun spillere (PLAYER)</option>
            <option value="TRAINER">Kun trænere (TRAINER)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Beskrivelse</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary resize-y"
            placeholder="Kort beskrivelse af produktet..."
          />
        </div>
      </section>

      {/* ── Flags ──────────────────────────────────────────────────────────── */}
      <section>
        <p className="text-sm font-medium text-gray-700 mb-3">Indstillinger</p>
        <div className="flex flex-wrap gap-6">
          {([
            { label: "Udgivet", checked: published, set: setPublished },
            { label: "Fremhævet på forsiden", checked: featured, set: setFeatured },
            { label: "Kun for medlemmer", checked: membersOnly, set: setMembersOnly },
            { label: "Tidlig adgang for medlemmer", checked: membersEarlyAccess, set: setMembersEarlyAccess },
          ] as { label: string; checked: boolean; set: (v: boolean) => void }[]).map(({ label, checked, set }) => (
            <label key={label} className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={checked} onChange={(e) => set(e.target.checked)} className="w-4 h-4 accent-secondary" />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>
      </section>

      {/* ── Main images ─────────────────────────────────────────────────────── */}
      <section>
        <p className="text-sm font-medium text-gray-700 mb-2">Billeder</p>
        <div className="flex flex-wrap gap-3 mb-2">
          {images.map((url, i) => (
            <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button type="button" onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                className="absolute top-0.5 right-0.5 bg-white/90 rounded-full w-5 h-5 text-xs text-red-600 font-bold hover:bg-white">
                ×
              </button>
            </div>
          ))}
          <button type="button" onClick={() => openCloudinaryWidget("main")}
            className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-secondary hover:text-secondary transition gap-1">
            <span className="text-2xl leading-none">+</span>
            <span className="text-xs">Upload</span>
          </button>
        </div>
        <p className="text-xs text-gray-400">Første billede bruges som thumbnail. Max 5 MB.</p>
      </section>

      {/* ── Tilvalg (Option groups) ─────────────────────────────────────────── */}
      <section>
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-700">Tilvalg &amp; lager</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Brug tilvalgsgrupper til farver, størrelser og tilpasningsmuligheder
          </p>
        </div>

        {/* Migration notice for legacy products */}
        {hasLegacyColors && !migratedToOptions && (
          <div className="mb-4 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <span className="text-amber-500 text-base mt-0.5">⚠</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800">Dette produkt bruger det gamle farvesystem</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Konverter til tilvalgsgrupper for at bruge det nye system med farvekoder, varenumre og SKU-matrix.
                Eksisterende farve- og størrelsesdata fjernes, og du bygger grupperne op fra bunden.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Konverter dette produkt til tilvalgsgrupper?\n\nEksisterende farve- og størrelsesdata vil blive fjernet, og du bygger tilvalgsgrupperne op fra bunden med skabelonbiblioteket.")) {
                  setMigratedToOptions(true);
                  setUseOptionGroups(true);
                }
              }}
              className="px-3 py-1.5 text-xs bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition shrink-0 font-medium"
            >
              Konverter
            </button>
          </div>
        )}

        {/* ── New option groups UI ─────────────────────────────────────────── */}
        {useOptionGroups && (!hasLegacyColors || migratedToOptions) && (
          <div className="space-y-4">
            {optionGroups.map((g, gi) => (
              <OptionGroupEditor
                key={g._key}
                group={g}
                globalColors={globalColors}
                modelNumber={modelNumber}
                colorGroup={colorGroup}
                sizeGroup={sizeGroup}
                onUpdate={(patch) => updateOptionGroup(g._key, patch)}
                onRemove={() => removeOptionGroup(g._key)}
                onAddValue={(v) => {
                  const key = addOptionValue(g._key, v);
                  // Expand matrix for new values
                  if (g.type === "COLOR") {
                    const sizes = sizeGroup?.values ?? [];
                    expandMatrix(g.values, sizes, key, undefined);
                  } else if (g.type === "SIZE") {
                    const colors = colorGroup?.values ?? [];
                    expandMatrix(colors, g.values, undefined, key);
                  }
                  return key;
                }}
                onRemoveValue={(vKey) => removeOptionValue(g._key, vKey, g.type)}
                onUpdateValue={(vKey, patch) => updateOptionValue(g._key, vKey, patch)}
                onUpload={(vKey) => openCloudinaryWidget({ type: "colorValue", key: vKey })}
                gi={gi}
              />
            ))}

            {/* Add group buttons — clicking expands inline template panel for that type */}
            <div className="flex flex-wrap gap-2">
              {(["COLOR", "SIZE", "TEXT", "SELECT", "CUSTOM"] as OptionType[]).map((type) => {
                const hasType = optionGroups.some((g) => g.type === type);
                const label: Record<OptionType, string> = {
                  COLOR: "Farve", SIZE: "Størrelse", TEXT: "Tryk/navn", SELECT: "Valgliste", CUSTOM: "Tilpasset"
                };
                const disabled = (type === "COLOR" || type === "SIZE") && hasType;
                const isExpanded = inlineExpandedType === type;
                return (
                  <button key={type} type="button" disabled={disabled}
                    onClick={() => toggleInlineType(type)}
                    className={`px-3 py-1.5 text-xs border rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed ${
                      isExpanded ? "bg-secondary text-white border-secondary" : "hover:border-secondary hover:text-secondary"
                    }`}>
                    + {label[type]}
                  </button>
                );
              })}
            </div>

            {/* Inline template panel — appears below buttons when a type is expanded */}
            {inlineExpandedType && (
              <div className="border rounded-xl p-4 bg-gray-50 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    {({ COLOR: "Farve", SIZE: "Størrelse", TEXT: "Tryk/navn", SELECT: "Valgliste", CUSTOM: "Tilpasset" } as Record<OptionType, string>)[inlineExpandedType]} — vælg skabelon
                  </p>
                  <button type="button" onClick={() => { setInlineExpandedType(null); setInlineFilterTag(null); }} className="text-gray-400 hover:text-gray-600">
                    <X size={16} />
                  </button>
                </div>

                {/* Tag filter */}
                {(() => {
                  const relevantTags = Array.from(new Set(
                    libraryTemplates.filter((t) => t.type === inlineExpandedType).flatMap((t) => t.tags)
                  )).sort();
                  if (relevantTags.length === 0) return null;
                  return (
                    <div className="flex flex-wrap gap-1.5">
                      {relevantTags.map((tag) => (
                        <button key={tag} type="button" onClick={() => setInlineFilterTag(inlineFilterTag === tag ? null : tag)}
                          className={`px-2.5 py-1 text-xs rounded-full font-medium transition ${
                            inlineFilterTag === tag
                              ? "bg-secondary text-white"
                              : "bg-white border border-gray-300 text-gray-600 hover:border-secondary hover:text-secondary"
                          }`}>
                          {tag}
                        </button>
                      ))}
                    </div>
                  );
                })()}

                {/* Template list */}
                {libraryLoading && <p className="text-xs text-gray-400">Henter skabeloner…</p>}
                <div className="space-y-2">
                  {libraryTemplates
                    .filter((t) => {
                      if (t.type !== inlineExpandedType) return false;
                      if (inlineFilterTag && !t.tags.includes(inlineFilterTag)) return false;
                      return true;
                    })
                    .map((t) => (
                      <div key={t.id} className="flex items-center gap-3 bg-white border rounded-lg px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{t.name}</p>
                          {t.values.length > 0 && (
                            <p className="text-xs text-gray-500 truncate">
                              {t.values.slice(0, 6).map((v) => v.label).join(" · ")}
                              {t.values.length > 6 && <span className="text-gray-400"> …+{t.values.length - 6}</span>}
                            </p>
                          )}
                          {t.tags.length > 0 && (
                            <div className="flex gap-1 mt-0.5 flex-wrap">
                              {t.tags.map((tag) => (
                                <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{tag}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <button type="button" onClick={() => applyTemplate(t)}
                          className="text-xs font-medium text-secondary hover:underline shrink-0">
                          Brug
                        </button>
                      </div>
                    ))}
                </div>

                {/* Fallback: create empty group */}
                <button
                  type="button"
                  onClick={() => { addOptionGroup(inlineExpandedType); setInlineExpandedType(null); setInlineFilterTag(null); }}
                  className="text-xs text-gray-500 hover:text-secondary underline underline-offset-2 transition"
                >
                  Opret tom gruppe
                </button>
              </div>
            )}

            {/* SKU matrix (shown when both COLOR and SIZE groups with values exist) */}
            {hasMatrix && colorGroup && sizeGroup && (
              <SkuMatrix
                colorGroup={colorGroup}
                sizeGroup={sizeGroup}
                matrix={skuMatrix}
                modelNumber={modelNumber}
                globalColors={globalColors}
                onUpdateCell={updateMatrixCell}
              />
            )}

            {/* Flat SKU table for SIZE-only (no COLOR) */}
            {sizeGroup && !colorGroup && sizeGroup.values.length > 0 && (
              <FlatSizeTable
                sizeGroup={sizeGroup}
                matrix={skuMatrix}
                modelNumber={modelNumber}
                onUpdateCell={(sizeKey, patch) => {
                  setSkuMatrix((prev) => {
                    const existing = prev.find((c) => c.sizeValueKey === sizeKey);
                    if (existing) {
                      return prev.map((c) => c.sizeValueKey === sizeKey ? { ...c, ...patch } : c);
                    }
                    return [...prev, { colorValueKey: "", sizeValueKey: sizeKey, stock: 0, itemNumber: "", itemNumberOverride: false, costPriceKr: "", ...patch }];
                  });
                }}
              />
            )}

            {/* Live margin panel */}
            {skuMatrix.some((c) => c.costPriceKr) && (() => {
              const salg = parseFloat(priceKr) || 0;
              const costs = skuMatrix
                .map((c) => parseFloat(c.costPriceKr))
                .filter((n) => !isNaN(n) && n > 0);
              if (costs.length === 0 || salg === 0) return null;
              const minCost = Math.min(...costs);
              const maxCost = Math.max(...costs);
              const minMargin = salg - maxCost;
              const maxMargin = salg - minCost;
              const minPct = Math.round((minMargin / salg) * 100);
              const maxPct = Math.round((maxMargin / salg) * 100);
              const sameRange = Math.abs(minCost - maxCost) < 0.01;
              return (
                <div className="border rounded-xl p-4 bg-blue-50 border-blue-200 text-sm space-y-1">
                  <p className="font-semibold text-blue-800">Avance (ekskl. moms)</p>
                  <div className="text-blue-700 space-y-0.5">
                    <p>Salgspris: <span className="font-medium">{salg.toFixed(2)} kr</span></p>
                    <p>Kostpris: <span className="font-medium">{sameRange ? `${minCost.toFixed(2)} kr` : `${minCost.toFixed(2)}–${maxCost.toFixed(2)} kr`}</span></p>
                    <p>Avance: <span className="font-bold">{sameRange ? `${maxMargin.toFixed(2)} kr (${maxPct}%)` : `${minMargin.toFixed(2)}–${maxMargin.toFixed(2)} kr (${minPct}–${maxPct}%)`}</span></p>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ── Legacy color variant UI ──────────────────────────────────────── */}
        {hasLegacyColors && !migratedToOptions && (
          <LegacyVariantSection
            legacySkus={legacySkus}
            legacyColorVariants={legacyColorVariants}
            onAddSize={addLegacySize}
            onRemoveSize={removeLegacySize}
            onUpdateSku={updateLegacySku}
            onAddColorVariant={addLegacyColorVariant}
            onRemoveColorVariant={removeLegacyColorVariant}
            onUpdateColorVariant={updateLegacyColorVariant}
            onAddColorSize={addLegacyColorSize}
            onUpdateColorSku={updateLegacyColorSku}
            onRemoveColorSize={removeLegacyColorSize}
            onUploadColor={(idx) => openCloudinaryWidget({ type: "legacyColor", idx })}
            onUploadMain={() => openCloudinaryWidget("main")}
          />
        )}
      </section>

      {/* ── Tryk-designer ────────────────────────────────────────────────────── */}
      <section className="space-y-4 border rounded-xl p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-700">Tryk-designer</h2>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={designerEnabled}
              onChange={(e) => setDesignerEnabled(e.target.checked)}
              className="rounded"
            />
            Aktivér tryk-designer til dette produkt
          </label>
        </div>

        {!isEdit && designerEnabled && (
          <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
            Gem produktet for at konfigurere designer-zoner og billeder.
          </p>
        )}

        {isEdit && designerEnabled && (
            <div className="space-y-5">
              {/* Front/back image selection */}
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Forside-billede</label>
                  <select
                    value={designerFrontImageIdx}
                    onChange={(e) => setDesignerFrontImageIdx(e.target.value === "" ? "" : parseInt(e.target.value))}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Ingen</option>
                    {images.map((_, i) => (
                      <option key={i} value={i}>Billede {i + 1}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Bagside-billede</label>
                  <select
                    value={designerBackImageIdx}
                    onChange={(e) => setDesignerBackImageIdx(e.target.value === "" ? "" : parseInt(e.target.value))}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Ingen</option>
                    {images.map((_, i) => (
                      <option key={i} value={i}>Billede {i + 1}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Tryk-farve</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={designerPrintColor}
                      onChange={(e) => setDesignerPrintColor(e.target.value)}
                      className="h-9 w-12 cursor-pointer rounded border border-gray-200 p-0.5"
                    />
                    <span className="text-xs font-mono text-gray-500">{designerPrintColor}</span>
                  </div>
                </div>
              </div>

              {/* Visual zone editor */}
              {(() => {
                const ZONE_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444", "#06B6D4"];
                const editorImgIdx = zoneEditorSide === "front"
                  ? (designerFrontImageIdx === "" ? 0 : Number(designerFrontImageIdx))
                  : (designerBackImageIdx === "" ? 0 : Number(designerBackImageIdx));
                const editorImgUrl = images[editorImgIdx];

                function getRelativePos(e: React.MouseEvent) {
                  const rect = zoneEditorRef.current!.getBoundingClientRect();
                  return {
                    x: Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100)),
                    y: Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100)),
                  };
                }

                const GRID_LABELS = [
                  ["Øverst venstre", "Øverst", "Øverst højre"],
                  ["Midt venstre",   "Midt",   "Midt højre"],
                  ["Nederst venstre","Nederst", "Nederst højre"],
                ];

                function toggleCell(key: string) {
                  setSelectedCells((prev) => {
                    const next = new Set(prev);
                    if (next.has(key)) next.delete(key); else next.add(key);
                    return next;
                  });
                }

                function commitPendingArea() {
                  if (!pendingArea) return;
                  const newZones: ZoneRow[] = [];
                  selectedCells.forEach((key) => {
                    const [row, col] = key.split(",").map(Number);
                    newZones.push({
                      side: zoneEditorSide,
                      label: GRID_LABELS[row][col],
                      position: "custom",
                      allowText: true,
                      allowLogo: false,
                      previewX: pendingArea.x + col * (pendingArea.w / 3),
                      previewY: pendingArea.y + row * (pendingArea.h / 3),
                      previewW: pendingArea.w / 3,
                      previewH: pendingArea.h / 3,
                      priceKr: "",
                    });
                  });
                  const nextIdx = designerZones.length + newZones.length - 1;
                  setDesignerZones((prev) => [...prev, ...newZones]);
                  setPendingArea(null);
                  setSelectedCells(new Set());
                  setSelectedZoneIdx(nextIdx);
                }

                function commitWholeArea() {
                  if (!pendingArea) return;
                  const newZone: ZoneRow = {
                    side: zoneEditorSide,
                    label: "Tryk",
                    position: "custom",
                    allowText: true,
                    allowLogo: false,
                    previewX: pendingArea.x,
                    previewY: pendingArea.y,
                    previewW: pendingArea.w,
                    previewH: pendingArea.h,
                    priceKr: "",
                  };
                  setDesignerZones((prev) => [...prev, newZone]);
                  setPendingArea(null);
                  setSelectedCells(new Set());
                  setSelectedZoneIdx(designerZones.length);
                }

                return (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-700">Placeringszoner</p>
                      <div className="flex gap-1 text-xs border rounded-lg p-0.5 bg-white">
                        {(["front", "back"] as const).map((s) => (
                          <button key={s} type="button"
                            onClick={() => setZoneEditorSide(s)}
                            className={`px-2 py-1 rounded-md transition ${zoneEditorSide === s ? "bg-secondary text-white" : "hover:bg-gray-100"}`}>
                            {s === "front" ? "Forside" : "Bagside"}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-4">
                      {/* Jersey image + drawing canvas */}
                      <div
                        ref={zoneEditorRef}
                        className="relative flex-1 select-none overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
                        style={{ cursor: "crosshair" }}
                        onMouseDown={(e) => {
                          if ((e.target as HTMLElement).closest("[data-zone]")) return;
                          if (pendingArea) {
                            setPendingArea(null);
                            setSelectedCells(new Set());
                            return;
                          }
                          const pos = getRelativePos(e);
                          drawStart.current = pos;
                          setDrawRect({ x: pos.x, y: pos.y, w: 0, h: 0 });
                          e.preventDefault();
                        }}
                        onMouseMove={(e) => {
                          if (!drawStart.current) return;
                          const pos = getRelativePos(e);
                          setDrawRect({
                            x: Math.min(drawStart.current.x, pos.x),
                            y: Math.min(drawStart.current.y, pos.y),
                            w: Math.abs(pos.x - drawStart.current.x),
                            h: Math.abs(pos.y - drawStart.current.y),
                          });
                        }}
                        onMouseUp={(e) => {
                          if (!drawStart.current) return;
                          const pos = getRelativePos(e);
                          const x = Math.min(drawStart.current.x, pos.x);
                          const y = Math.min(drawStart.current.y, pos.y);
                          const w = Math.abs(pos.x - drawStart.current.x);
                          const h = Math.abs(pos.y - drawStart.current.y);
                          drawStart.current = null;
                          setDrawRect(null);
                          if (w < 3 || h < 3) return;
                          setPendingArea({ x, y, w, h });
                          setSelectedCells(new Set());
                        }}
                        onMouseLeave={() => {
                          if (drawStart.current) { drawStart.current = null; setDrawRect(null); }
                        }}
                      >
                        {editorImgUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={editorImgUrl} alt="Jersey" className="w-full object-contain pointer-events-none" />
                        ) : (
                          <div className="aspect-[3/4] flex items-center justify-center text-gray-300 text-sm">
                            Vælg et billede ovenfor
                          </div>
                        )}

                        {/* Existing zones for current side */}
                        {designerZones.map((zone, zi) => {
                          if (zone.side !== zoneEditorSide) return null;
                          const color = ZONE_COLORS[zi % ZONE_COLORS.length];
                          return (
                            <div
                              key={zi}
                              data-zone="true"
                              className={`absolute transition ${selectedZoneIdx === zi ? "ring-2 ring-white ring-offset-1" : ""}`}
                              style={{
                                left: `${zone.previewX}%`, top: `${zone.previewY}%`,
                                width: `${zone.previewW}%`, height: `${zone.previewH}%`,
                                backgroundColor: color + "33",
                                border: `2px solid ${color}`,
                                borderRadius: 3,
                                cursor: "pointer",
                              }}
                              onMouseDown={(e) => { e.stopPropagation(); setSelectedZoneIdx(zi); }}
                            >
                              <span className="absolute top-0.5 left-1 text-xs font-semibold leading-none select-none"
                                style={{ color, textShadow: "0 0 4px white, 0 0 4px white" }}>
                                {zone.label || `Zone ${zi + 1}`}
                              </span>
                              <button
                                type="button"
                                data-zone="true"
                                className="absolute top-0.5 right-0.5 text-xs bg-white text-red-500 rounded-full w-4 h-4 flex items-center justify-center leading-none hover:bg-red-50"
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDesignerZones((prev) => prev.filter((_, i) => i !== zi));
                                  setSelectedZoneIdx(null);
                                }}
                              >
                                ×
                              </button>
                            </div>
                          );
                        })}

                        {/* Live drawing preview */}
                        {drawRect && drawRect.w > 1 && drawRect.h > 1 && (
                          <div
                            className="absolute pointer-events-none border-2 border-dashed border-secondary bg-secondary/10"
                            style={{ left: `${drawRect.x}%`, top: `${drawRect.y}%`, width: `${drawRect.w}%`, height: `${drawRect.h}%` }}
                          />
                        )}

                        {/* 3×3 grid overlay for pending area */}
                        {pendingArea && (
                          <div
                            className="absolute pointer-events-none"
                            style={{ left: `${pendingArea.x}%`, top: `${pendingArea.y}%`, width: `${pendingArea.w}%`, height: `${pendingArea.h}%`, border: "2px dashed rgba(59,130,246,0.6)" }}
                          >
                            {[0, 1, 2].map((row) =>
                              [0, 1, 2].map((col) => {
                                const key = `${row},${col}`;
                                const isSelected = selectedCells.has(key);
                                return (
                                  <button
                                    key={key}
                                    type="button"
                                    data-zone="true"
                                    className="absolute pointer-events-auto transition-colors"
                                    style={{
                                      left: `${col * 33.33}%`, top: `${row * 33.33}%`,
                                      width: "33.34%", height: "33.34%",
                                      border: isSelected ? "2px solid rgba(59,130,246,0.9)" : "1px dashed rgba(255,255,255,0.5)",
                                      background: isSelected ? "rgba(59,130,246,0.35)" : "rgba(255,255,255,0.06)",
                                    }}
                                    onClick={(e) => { e.stopPropagation(); toggleCell(key); }}
                                  >
                                    {isSelected && (
                                      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-semibold text-white leading-tight text-center px-0.5">
                                        {GRID_LABELS[row][col]}
                                      </span>
                                    )}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>

                      {/* Commit panel — shown when pendingArea is set */}
                      {pendingArea && (
                        <div className="mt-2 p-3 border border-blue-200 rounded-lg bg-blue-50 space-y-2">
                          <p className="text-xs font-medium text-blue-800">
                            Klik på celler i gitteret for at vælge zoner ({selectedCells.size} valgt)
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={selectedCells.size === 0}
                              onClick={commitPendingArea}
                              className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40 hover:bg-blue-700 transition"
                            >
                              Tilføj {selectedCells.size} zone{selectedCells.size !== 1 ? "r" : ""}
                            </button>
                            <button
                              type="button"
                              onClick={commitWholeArea}
                              className="bg-white border border-blue-300 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-50 transition"
                            >
                              Hele området som én zone
                            </button>
                            <button
                              type="button"
                              onClick={() => { setPendingArea(null); setSelectedCells(new Set()); }}
                              className="text-gray-500 hover:text-gray-700 text-xs px-2 py-1.5"
                            >
                              Annuller
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Properties panel */}
                      {selectedZoneIdx !== null && designerZones[selectedZoneIdx] && (() => {
                        const zone = designerZones[selectedZoneIdx];
                        const update = (patch: Partial<ZoneRow>) =>
                          setDesignerZones((prev) => prev.map((z, i) => i === selectedZoneIdx ? { ...z, ...patch } : z));
                        return (
                          <div className="w-44 shrink-0 space-y-3 text-sm">
                            <p className="font-medium text-gray-700">Zone {selectedZoneIdx + 1}</p>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Label</label>
                              <input type="text" placeholder="f.eks. Ryg øverst" value={zone.label}
                                onChange={(e) => update({ label: e.target.value })}
                                className="w-full border rounded-lg px-2 py-1.5 text-sm" autoFocus />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Side</label>
                              <select value={zone.side}
                                onChange={(e) => update({ side: e.target.value as "front" | "back" })}
                                className="w-full border rounded-lg px-2 py-1.5 text-sm">
                                <option value="front">Forside</option>
                                <option value="back">Bagside</option>
                              </select>
                            </div>
                            <div className="space-y-1.5">
                              <label className="flex items-center gap-2 cursor-pointer text-xs">
                                <input type="checkbox" checked={zone.allowText}
                                  onChange={(e) => update({ allowText: e.target.checked })} className="rounded" />
                                Tillad tekst
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer text-xs">
                                <input type="checkbox" checked={zone.allowLogo}
                                  onChange={(e) => update({ allowLogo: e.target.checked })} className="rounded" />
                                Tillad logo
                              </label>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Pris (kr)</label>
                              <input type="number" min="0" step="0.01" placeholder="0.00"
                                value={zone.priceKr}
                                onChange={(e) => update({ priceKr: e.target.value })}
                                className="w-full border rounded-lg px-2 py-1.5 text-sm" />
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    <p className="text-xs text-gray-400">Tegn et rektangel på billedet → vælg celler i gitteret → klik "Tilføj". Klik en eksisterende zone for at redigere den.</p>
                  </div>
                );
              })()}

              <button
                type="button"
                onClick={saveDesigner}
                disabled={designerSaving}
                className="bg-secondary text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {designerSaving ? "Gemmer…" : "Gem designer-opsætning"}
              </button>
            </div>
        )}
      </section>

      {/* ── Actions ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-3 pt-2 border-t">
        <button type="submit" disabled={saving}
          className="bg-primary text-secondary font-bold px-6 py-2 rounded-xl hover:bg-primary-dark transition text-sm disabled:opacity-50">
          {saving ? "Gemmer..." : isEdit ? "Gem ændringer" : "Opret produkt"}
        </button>
        <a href="/admin/produkter"
          className="px-6 py-2 rounded-xl border text-sm text-gray-600 hover:border-gray-400 transition">
          Annuller
        </a>
      </div>
    </form>
  );
}

// ─── OptionGroupEditor ─────────────────────────────────────────────────────────

function OptionGroupEditor({
  group, globalColors,
  onUpdate, onRemove, onAddValue, onRemoveValue, onUpdateValue, onUpload,
}: {
  group: OptionGroupRow;
  globalColors: GlobalColor[];
  modelNumber?: string;
  colorGroup?: OptionGroupRow;
  sizeGroup?: OptionGroupRow;
  onUpdate: (patch: Partial<OptionGroupRow>) => void;
  onRemove: () => void;
  onAddValue: (v: Omit<OptionValueRow, "_key" | "images">) => string;
  onRemoveValue: (key: string) => void;
  onUpdateValue: (key: string, patch: Partial<OptionValueRow>) => void;
  onUpload: (key: string) => void;
  gi?: number;
}) {
  const typeLabels: Record<OptionType, string> = {
    COLOR: "Farve", SIZE: "Størrelse", TEXT: "Tryk/navn", SELECT: "Valgliste", CUSTOM: "Tilpasset"
  };

  const usedColorIds = group.type === "COLOR" ? group.values.map((v) => v.globalColorId).filter(Boolean) : [];
  const usedSizes = group.type === "SIZE" ? group.values.map((v) => v.label) : [];

  return (
    <div className="border rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
          {typeLabels[group.type]}
        </span>
        <input type="text" value={group.label} onChange={(e) => onUpdate({ label: e.target.value })}
          className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
          placeholder="Gruppenavn"
        />
        <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
          <input type="checkbox" checked={group.required} onChange={(e) => onUpdate({ required: e.target.checked })} className="accent-secondary" />
          Påkrævet
        </label>
        <button type="button" onClick={onRemove} className="text-xs text-red-400 hover:text-red-600">Fjern</button>
      </div>

      {/* TEXT / CUSTOM fee */}
      {(group.type === "TEXT" || group.type === "CUSTOM") && (
        <div className="flex gap-3 items-end flex-wrap">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Gebyr ekskl. moms (kr)</label>
            <input type="number" min="0" step="0.01" value={group.feeKr}
              onChange={(e) => onUpdate({ feeKr: e.target.value })}
              className="w-28 border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-secondary"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Kostpris ekskl. moms (kr)</label>
            <input type="number" min="0" step="0.01" value={group.costFeeKr}
              onChange={(e) => onUpdate({ costFeeKr: e.target.value })}
              className="w-28 border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-secondary"
              placeholder="0.00"
            />
          </div>
          {group.type === "CUSTOM" && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Input-type</label>
              <select value={group.inputType} onChange={(e) => onUpdate({ inputType: e.target.value })}
                className="border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-secondary">
                <option value="text">Tekst</option>
                <option value="number">Tal</option>
                <option value="checkbox">Afkrydsning</option>
                <option value="dropdown">Dropdown</option>
              </select>
            </div>
          )}
        </div>
      )}

      {/* COLOR values — pick from global library */}
      {group.type === "COLOR" && (
        <div>
          <p className="text-xs text-gray-500 mb-2">Vælg farver fra biblioteket:</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {globalColors.filter((gc) => !usedColorIds.includes(gc.id)).map((gc) => (
              <button key={gc.id} type="button"
                onClick={() => onAddValue({ label: gc.name, position: group.values.length, globalColorId: gc.id, globalColorHex: gc.hex })}
                className="flex items-center gap-1.5 px-2 py-1 border rounded-lg text-xs hover:border-secondary transition"
                title={`${gc.name} (${gc.code})`}
              >
                <span className="w-4 h-4 rounded-full border border-gray-200 flex-shrink-0" style={{ background: gc.hex }} />
                {gc.name}
              </button>
            ))}
            {globalColors.length === 0 && (
              <p className="text-xs text-gray-400 italic">
                Ingen farver i biblioteket —{" "}
                <a href="/admin/farver" target="_blank" className="underline text-secondary">tilføj farver</a>
              </p>
            )}
          </div>

          {/* Added color values */}
          {group.values.length > 0 && (
            <div className="space-y-2">
              {group.values.map((v) => (
                <div key={v._key} className="flex items-center gap-2 border rounded-lg px-3 py-2">
                  <span className="w-5 h-5 rounded-full border border-gray-200 flex-shrink-0" style={{ background: v.globalColorHex ?? "#ccc" }} />
                  <span className="text-sm font-medium flex-1">{v.label}</span>
                  {/* Images */}
                  <div className="flex gap-1">
                    {v.images.map((url, imgIdx) => (
                      <div key={imgIdx} className="relative w-10 h-10 rounded overflow-hidden border">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        <button type="button"
                          onClick={() => onUpdateValue(v._key, { images: v.images.filter((_, j) => j !== imgIdx) })}
                          className="absolute inset-0 bg-black/40 text-white text-xs flex items-center justify-center opacity-0 hover:opacity-100">
                          ×
                        </button>
                      </div>
                    ))}
                    <button type="button" onClick={() => onUpload(v._key)}
                      className="w-10 h-10 border-2 border-dashed border-gray-300 rounded flex items-center justify-center text-gray-400 hover:border-secondary hover:text-secondary text-lg transition">
                      +
                    </button>
                  </div>
                  <button type="button" onClick={() => onRemoveValue(v._key)} className="text-xs text-red-400 hover:text-red-600">Fjern</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SIZE values — click to add standard sizes */}
      {group.type === "SIZE" && (
        <div>
          <div className="flex flex-wrap gap-2 mb-2">
            <span className="text-xs text-gray-500 self-center">Tilføj:</span>
            {ALL_SIZES.filter((sz) => !usedSizes.includes(sz)).map((sz) => (
              <button key={sz} type="button"
                onClick={() => onAddValue({ label: sz, position: group.values.length })}
                className="px-2.5 py-1 text-xs border rounded-lg hover:border-secondary hover:text-secondary transition">
                {sz}
              </button>
            ))}
          </div>
          {group.values.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {group.values.map((v) => (
                <div key={v._key} className="flex items-center gap-1 bg-gray-50 border rounded-lg px-2.5 py-1">
                  <span className="text-sm font-mono">{v.label}</span>
                  <button type="button" onClick={() => onRemoveValue(v._key)} className="text-red-400 hover:text-red-600 text-xs ml-1">×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SELECT values — add/remove text values */}
      {group.type === "SELECT" && (
        <div>
          <div className="flex gap-2 mb-2">
            <SelectValueAdder onAdd={(label) => onAddValue({ label, position: group.values.length })} />
          </div>
          {group.values.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {group.values.map((v) => (
                <div key={v._key} className="flex items-center gap-1 bg-gray-50 border rounded-lg px-2.5 py-1">
                  <span className="text-sm">{v.label}</span>
                  <button type="button" onClick={() => onRemoveValue(v._key)} className="text-red-400 hover:text-red-600 text-xs ml-1">×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TEXT: no values (it's a free input) */}
      {group.type === "TEXT" && (
        <p className="text-xs text-gray-400 italic">
          Tekstfelt — kunden skriver frit (navn, nummer, initialer, osv.)
        </p>
      )}
    </div>
  );
}

function SelectValueAdder({ onAdd }: { onAdd: (label: string) => void }) {
  const [val, setVal] = useState("");
  return (
    <div className="flex gap-2">
      <input type="text" value={val} onChange={(e) => setVal(e.target.value)} placeholder="Tilvalg..."
        className="border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-secondary"
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (val.trim()) { onAdd(val.trim()); setVal(""); } } }}
      />
      <button type="button" onClick={() => { if (val.trim()) { onAdd(val.trim()); setVal(""); } }}
        className="px-3 py-1.5 text-xs border rounded-lg hover:border-secondary hover:text-secondary transition">
        + Tilføj
      </button>
    </div>
  );
}

// ─── SkuMatrix ─────────────────────────────────────────────────────────────────

function SkuMatrix({
  colorGroup, sizeGroup, matrix, modelNumber, globalColors, onUpdateCell,
}: {
  colorGroup: OptionGroupRow;
  sizeGroup: OptionGroupRow;
  matrix: SkuMatrixCell[];
  modelNumber: string;
  globalColors: GlobalColor[];
  onUpdateCell: (colorKey: string, sizeKey: string, patch: Partial<SkuMatrixCell>) => void;
}) {
  return (
    <div className="border rounded-xl overflow-hidden mt-4">
      <div className="px-4 py-2 bg-gray-50 border-b">
        <p className="text-sm font-medium text-gray-700">Lager, varenumre &amp; kostpris</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-gray-500">
              <th className="px-3 py-2 text-left font-medium text-xs">Farve</th>
              {sizeGroup.values.map((sv) => (
                <th key={sv._key} className="px-3 py-2 text-center font-medium text-xs min-w-[110px]">{sv.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {colorGroup.values.map((cv) => {
              const gc = globalColors.find((g) => g.id === cv.globalColorId);
              return (
                <tr key={cv._key}>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full border border-gray-200 flex-shrink-0" style={{ background: cv.globalColorHex ?? "#ccc" }} />
                      <span className="text-xs font-medium">{cv.label}</span>
                    </div>
                  </td>
                  {sizeGroup.values.map((sv) => {
                    const cell = matrix.find((c) => c.colorValueKey === cv._key && c.sizeValueKey === sv._key);
                    const autoItemNumber = generatePreviewItemNumber(modelNumber, gc?.code, sv.label);
                    return (
                      <td key={sv._key} className="px-2 py-2 text-center">
                        <div className="space-y-1">
                          <input type="number" min="0" value={cell?.stock ?? 0}
                            onChange={(e) => onUpdateCell(cv._key, sv._key, { stock: parseInt(e.target.value, 10) || 0 })}
                            className="w-full border rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-secondary"
                            placeholder="0"
                          />
                          <div className="flex items-center gap-1">
                            <input type="text"
                              value={cell?.itemNumberOverride ? (cell.itemNumber ?? "") : autoItemNumber}
                              onChange={(e) => onUpdateCell(cv._key, sv._key, { itemNumber: e.target.value, itemNumberOverride: true })}
                              disabled={!cell?.itemNumberOverride}
                              className="flex-1 border rounded px-1.5 py-0.5 text-xs font-mono text-center focus:outline-none focus:ring-1 focus:ring-secondary disabled:bg-gray-50 disabled:text-gray-400"
                              placeholder={autoItemNumber || "varenr."}
                            />
                            <input type="checkbox" title="Override" checked={cell?.itemNumberOverride ?? false}
                              onChange={(e) => {
                                const override = e.target.checked;
                                onUpdateCell(cv._key, sv._key, {
                                  itemNumberOverride: override,
                                  itemNumber: override ? (cell?.itemNumber ?? autoItemNumber) : "",
                                });
                              }}
                              className="accent-secondary w-3 h-3 cursor-pointer"
                            />
                          </div>
                          <input type="number" min="0" step="0.01" value={cell?.costPriceKr ?? ""}
                            onChange={(e) => onUpdateCell(cv._key, sv._key, { costPriceKr: e.target.value })}
                            className="w-full border rounded px-2 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-secondary text-gray-500"
                            placeholder="kostpris kr"
                          />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400 px-4 py-2 border-t">
        Varenummer genereres automatisk fra modelnummer+farvekode+størrelse. Sæt flueben for at angive manuelt.
      </p>
    </div>
  );
}

// ─── FlatSizeTable ─────────────────────────────────────────────────────────────

function FlatSizeTable({
  sizeGroup, matrix, modelNumber, onUpdateCell,
}: {
  sizeGroup: OptionGroupRow;
  matrix: SkuMatrixCell[];
  modelNumber: string;
  onUpdateCell: (sizeKey: string, patch: Partial<SkuMatrixCell>) => void;
}) {
  return (
    <div className="border rounded-xl overflow-hidden mt-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b text-gray-500">
            <th className="px-4 py-2 text-left font-medium text-xs">Størrelse</th>
            <th className="px-4 py-2 text-left font-medium text-xs">Varenummer</th>
            <th className="px-4 py-2 text-left font-medium text-xs">Lager</th>
            <th className="px-4 py-2 text-left font-medium text-xs">Kostpris (kr)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sizeGroup.values.map((sv) => {
            const cell = matrix.find((c) => c.sizeValueKey === sv._key);
            const autoItemNumber = generatePreviewItemNumber(modelNumber, null, sv.label);
            return (
              <tr key={sv._key}>
                <td className="px-4 py-2 font-mono font-semibold">{sv.label}</td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <input type="text"
                      value={cell?.itemNumberOverride ? (cell.itemNumber ?? "") : autoItemNumber}
                      onChange={(e) => onUpdateCell(sv._key, { itemNumber: e.target.value, itemNumberOverride: true })}
                      disabled={!cell?.itemNumberOverride}
                      className="w-32 border rounded px-2 py-1 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-secondary disabled:bg-gray-50 disabled:text-gray-400"
                      placeholder={autoItemNumber || "varenr."}
                    />
                    <label className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer">
                      <input type="checkbox" checked={cell?.itemNumberOverride ?? false}
                        onChange={(e) => onUpdateCell(sv._key, { itemNumberOverride: e.target.checked, itemNumber: e.target.checked ? (cell?.itemNumber ?? autoItemNumber) : "" })}
                        className="accent-secondary"
                      />
                      Manuel
                    </label>
                  </div>
                </td>
                <td className="px-4 py-2">
                  <input type="number" min="0" value={cell?.stock ?? 0}
                    onChange={(e) => onUpdateCell(sv._key, { stock: parseInt(e.target.value, 10) || 0 })}
                    className="w-24 border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                  />
                </td>
                <td className="px-4 py-2">
                  <input type="number" min="0" step="0.01" value={cell?.costPriceKr ?? ""}
                    onChange={(e) => onUpdateCell(sv._key, { costPriceKr: e.target.value })}
                    className="w-28 border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-secondary text-gray-500"
                    placeholder="0.00"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── LegacyVariantSection ──────────────────────────────────────────────────────

function LegacyVariantSection({
  legacySkus, legacyColorVariants,
  onAddSize, onRemoveSize, onUpdateSku,
  onAddColorVariant, onRemoveColorVariant, onUpdateColorVariant,
  onAddColorSize, onUpdateColorSku, onRemoveColorSize,
  onUploadColor, onUploadMain: _onUploadMain,
}: {
  legacySkus: LegacySkuRow[];
  legacyColorVariants: LegacyColorVariantRow[];
  onAddSize: (sz: string) => void;
  onRemoveSize: (sz: string) => void;
  onUpdateSku: (sz: string, patch: Partial<LegacySkuRow>) => void;
  onAddColorVariant: () => void;
  onRemoveColorVariant: (idx: number) => void;
  onUpdateColorVariant: (idx: number, patch: Partial<LegacyColorVariantRow>) => void;
  onAddColorSize: (cvIdx: number, sz: string) => void;
  onUpdateColorSku: (cvIdx: number, sz: string, patch: Partial<LegacySkuRow>) => void;
  onRemoveColorSize: (cvIdx: number, sz: string) => void;
  onUploadColor: (idx: number) => void;
  onUploadMain: () => void;
}) {
  const usedSizes = legacySkus.map((s) => s.size);

  return (
    <>
      {/* Color Variants */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-gray-700">Farver (Legacy)</p>
          <button type="button" onClick={onAddColorVariant}
            className="px-3 py-1.5 text-xs border rounded-lg hover:border-secondary hover:text-secondary transition">
            + Tilføj farve
          </button>
        </div>

        {legacyColorVariants.length === 0 && (
          <p className="text-sm text-gray-400 italic border rounded-lg px-4 py-3">
            Ingen farver tilføjet. Størrelser håndteres nedenfor.
          </p>
        )}

        {legacyColorVariants.map((cv, cvIdx) => {
          const usedCvSizes = cv.skus.map((s) => s.size);
          return (
            <div key={cvIdx} className="border rounded-xl p-4 mb-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full border border-gray-300 flex-shrink-0" style={{ backgroundColor: cv.hex }} />
                <input type="text" value={cv.name} onChange={(e) => onUpdateColorVariant(cvIdx, { name: e.target.value })}
                  placeholder="Farvenavn" className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary" />
                <input type="color" value={cv.hex} onChange={(e) => onUpdateColorVariant(cvIdx, { hex: e.target.value })}
                  className="w-10 h-9 border rounded-lg cursor-pointer p-0.5" />
                <button type="button" onClick={() => onRemoveColorVariant(cvIdx)} className="text-xs text-red-400 hover:text-red-600 underline">Fjern</button>
              </div>

              <div>
                <p className="text-xs text-gray-500 mb-2">Billeder</p>
                <div className="flex flex-wrap gap-2">
                  {cv.images.map((url, imgIdx) => (
                    <div key={imgIdx} className="relative w-16 h-16 rounded-lg overflow-hidden border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button type="button"
                        onClick={() => onUpdateColorVariant(cvIdx, { images: cv.images.filter((_, j) => j !== imgIdx) })}
                        className="absolute top-0.5 right-0.5 bg-white/90 rounded-full w-4 h-4 text-xs text-red-600 font-bold hover:bg-white">
                        ×
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={() => onUploadColor(cvIdx)}
                    className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-secondary hover:text-secondary transition gap-0.5">
                    <span className="text-xl leading-none">+</span>
                    <span className="text-[10px]">Upload</span>
                  </button>
                </div>
              </div>

              <div>
                <div className="flex flex-wrap gap-2 mb-2">
                  <span className="text-xs text-gray-500 self-center">Tilføj størrelse:</span>
                  {ALL_SIZES.filter((sz) => !usedCvSizes.includes(sz)).map((sz) => (
                    <button key={sz} type="button" onClick={() => onAddColorSize(cvIdx, sz)}
                      className="px-2 py-0.5 text-xs border rounded-lg hover:border-secondary hover:text-secondary transition">
                      {sz}
                    </button>
                  ))}
                </div>
                {cv.skus.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b">
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Størrelse</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Varenummer</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Lager</th>
                          <th className="px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {cv.skus.map((sku) => (
                          <tr key={sku.size}>
                            <td className="px-3 py-2 font-mono font-semibold text-sm">{sku.size}</td>
                            <td className="px-3 py-2">
                              <input type="text" value={sku.itemNumber ?? ""} onChange={(e) => onUpdateColorSku(cvIdx, sku.size, { itemNumber: e.target.value })}
                                className="w-32 border rounded px-2 py-1 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-secondary" />
                            </td>
                            <td className="px-3 py-2">
                              <input type="number" min="0" value={sku.stock} onChange={(e) => onUpdateColorSku(cvIdx, sku.size, { stock: parseInt(e.target.value, 10) || 0 })}
                                className="w-20 border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-secondary" />
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button type="button" onClick={() => onRemoveColorSize(cvIdx, sku.size)} className="text-xs text-red-400 hover:text-red-600 underline">Fjern</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Global SKUs — only when no color variants */}
      {legacyColorVariants.length === 0 && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Størrelser &amp; lager</p>
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="text-xs text-gray-500 self-center">Tilføj størrelse:</span>
            {ALL_SIZES.filter((sz) => !usedSizes.includes(sz)).map((sz) => (
              <button key={sz} type="button" onClick={() => onAddSize(sz)}
                className="px-2.5 py-1 text-xs border rounded-lg hover:border-secondary hover:text-secondary transition">
                {sz}
              </button>
            ))}
          </div>
          {legacySkus.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Størrelse</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Varenummer</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Lager</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {legacySkus.map((sku) => (
                    <tr key={sku.size}>
                      <td className="px-4 py-2 font-mono font-semibold">{sku.size}</td>
                      <td className="px-4 py-2">
                        <input type="text" value={sku.itemNumber ?? ""} onChange={(e) => onUpdateSku(sku.size, { itemNumber: e.target.value })}
                          className="w-36 border rounded px-2 py-1 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-secondary" />
                      </td>
                      <td className="px-4 py-2">
                        <input type="number" min="0" value={sku.stock} onChange={(e) => onUpdateSku(sku.size, { stock: parseInt(e.target.value, 10) || 0 })}
                          className="w-24 border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-secondary" />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button type="button" onClick={() => onRemoveSize(sku.size)} className="text-xs text-red-400 hover:text-red-600 underline">Fjern</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic border rounded-lg px-4 py-3">
              Ingen størrelser tilføjet endnu.
            </p>
          )}
        </div>
      )}
    </>
  );
}
