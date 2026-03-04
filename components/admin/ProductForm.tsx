"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { slugify } from "@/lib/utils";
import type { Product, SKU, Category, ClubRole, ColorVariant, ProductOptionGroup, ProductOptionValue, GlobalColor, OptionGroupTemplate, OptionGroupTemplateValue } from "@prisma/client";
import { BookOpen, X } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type OptionValueWithColor = ProductOptionValue & { globalColor: GlobalColor | null };
type OptionGroupWithValues = ProductOptionGroup & { values: OptionValueWithColor[] };
type ColorVariantWithSkus = ColorVariant & { skus: SKU[] };
type ProductWithRelations = Product & {
  skus: SKU[];
  category: Category | null;
  colorVariants: ColorVariantWithSkus[];
  optionGroups: OptionGroupWithValues[];
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

  // ── New option groups system ────────────────────────────────────────────────
  const [useOptionGroups, setUseOptionGroups] = useState(hasOptionGroups);
  const [globalColors, setGlobalColors] = useState<GlobalColor[]>([]);

  // ── Template library panel ──────────────────────────────────────────────────
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryTemplates, setLibraryTemplates] = useState<TemplateFull[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryFilterType, setLibraryFilterType] = useState<OptionType | "ALL">("ALL");
  const [libraryFilterTag, setLibraryFilterTag] = useState<string | null>(null);

  const [optionGroups, setOptionGroups] = useState<OptionGroupRow[]>(() => {
    if (!product?.optionGroups.length) return [];
    return product.optionGroups.map((g) => ({
      id: g.id,
      _key: nextKey(),
      type: g.type as OptionType,
      label: g.label,
      position: g.position,
      required: g.required,
      feeKr: g.fee ? (g.fee / 100).toFixed(2) : "",
      inputType: g.inputType ?? "",
      values: g.values.map((v) => ({
        id: v.id,
        _key: nextKey(),
        label: v.label,
        position: v.position,
        globalColorId: v.globalColorId,
        globalColorHex: v.globalColor?.hex,
        images: v.images,
      })),
    }));
  });

  const [skuMatrix, setSkuMatrix] = useState<SkuMatrixCell[]>(() => {
    if (!product?.optionGroups.length) return [];
    const colorGroup = product.optionGroups.find((g) => g.type === "COLOR");
    const sizeGroup = product.optionGroups.find((g) => g.type === "SIZE");
    if (!colorGroup || !sizeGroup) return [];

    // Map DB value ids to the _key we assign during optionGroups initialization
    // We need to rebuild this by re-running the initialization logic
    // For simplicity during first load, we build a map from DB ids to keys
    const colorValueKeyMap = new Map<string, string>();
    const sizeValueKeyMap = new Map<string, string>();

    // We need the keys from the optionGroups state above — but since we're in
    // the same initializer, we re-generate them inline
    let tempKeySeq = _keySeq;
    const getKey = () => `k${++tempKeySeq}`;

    const builtGroups = product.optionGroups.map((g) => ({
      id: g.id,
      type: g.type,
      values: g.values.map((v) => ({ id: v.id, key: getKey() })),
    }));

    const builtColorGroup = builtGroups.find((g) => g.type === "COLOR");
    const builtSizeGroup = builtGroups.find((g) => g.type === "SIZE");

    builtColorGroup?.values.forEach((v, i) => {
      colorValueKeyMap.set(colorGroup.values[i]?.id ?? "", v.key);
    });
    builtSizeGroup?.values.forEach((v, i) => {
      sizeValueKeyMap.set(sizeGroup.values[i]?.id ?? "", v.key);
    });

    // SKU matrix from existing SKUs — populated after migration via seed script
    return [];
  });

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
      required: type === "SIZE", feeKr: "", inputType: "text", values: [],
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
            next.push({ colorValueKey: newColorKey, sizeValueKey: sv._key, stock: 0, itemNumber: "", itemNumberOverride: false });
          }
        }
      }
      if (newSizeKey) {
        // Add columns for new size × all existing colors
        for (const cv of colorValues) {
          if (!next.find((c) => c.colorValueKey === cv._key && c.sizeValueKey === newSizeKey)) {
            next.push({ colorValueKey: cv._key, sizeValueKey: newSizeKey, stock: 0, itemNumber: "", itemNumberOverride: false });
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

  function openLibrary() {
    setLibraryOpen(true);
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
                next.push({ colorValueKey: cv._key, sizeValueKey: sv._key, stock: 0, itemNumber: "", itemNumberOverride: false });
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
                next.push({ colorValueKey: cv._key, sizeValueKey: sv._key, stock: 0, itemNumber: "", itemNumberOverride: false });
              }
            }
          }
          return next;
        });
      }
    }

    setLibraryOpen(false);
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
        }));

        payload = {
          name, slug, categoryId: categoryId || null, price: Math.round(priceVal * 100),
          modelNumber: modelNumber || null, description, images,
          membersOnly, membersEarlyAccess, clubRoleRequired: clubRoleRequired || null,
          published, featured,
          optionGroups: groupsPayload,
          skuMatrix: matrixPayload,
        };
      } else {
        // Legacy path
        payload = {
          name, slug, categoryId: categoryId || null, price: Math.round(priceVal * 100),
          modelNumber: modelNumber || null, description, images,
          membersOnly, membersEarlyAccess, clubRoleRequired: clubRoleRequired || null,
          published, featured,
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
              Pris (kr) <span className="text-red-500">*</span>
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
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-medium text-gray-700">Tilvalg &amp; lager</p>
            {!hasLegacyColors && (
              <p className="text-xs text-gray-400 mt-0.5">
                Brug tilvalgsgrupper til farver, størrelser og tilpasningsmuligheder
              </p>
            )}
          </div>
          {!hasLegacyColors && (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={useOptionGroups} onChange={(e) => setUseOptionGroups(e.target.checked)}
                className="w-4 h-4 accent-secondary" />
              <span className="text-sm text-gray-600">Brug tilvalgsgrupper</span>
            </label>
          )}
        </div>

        {/* ── New option groups UI ─────────────────────────────────────────── */}
        {useOptionGroups && !hasLegacyColors && (
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

            {/* Add group buttons */}
            <div className="flex flex-wrap gap-2">
              {(["COLOR", "SIZE", "TEXT", "SELECT", "CUSTOM"] as OptionType[]).map((type) => {
                const hasType = optionGroups.some((g) => g.type === type);
                const label: Record<OptionType, string> = {
                  COLOR: "Farve", SIZE: "Størrelse", TEXT: "Tryk/navn", SELECT: "Valgliste", CUSTOM: "Tilpasset"
                };
                // Only allow one COLOR and one SIZE group
                const disabled = (type === "COLOR" || type === "SIZE") && hasType;
                return (
                  <button key={type} type="button" onClick={() => addOptionGroup(type)} disabled={disabled}
                    className="px-3 py-1.5 text-xs border rounded-lg hover:border-secondary hover:text-secondary transition disabled:opacity-40 disabled:cursor-not-allowed">
                    + {label[type]}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => libraryOpen ? setLibraryOpen(false) : openLibrary()}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs border rounded-lg transition ${
                  libraryOpen ? "bg-secondary text-white border-secondary" : "hover:border-secondary hover:text-secondary"
                }`}
              >
                <BookOpen size={12} />
                Fra bibliotek
              </button>
            </div>

            {/* Template library panel */}
            {libraryOpen && (
              <div className="border rounded-xl p-4 bg-gray-50 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Vælg skabelon</p>
                  <button type="button" onClick={() => setLibraryOpen(false)} className="text-gray-400 hover:text-gray-600">
                    <X size={16} />
                  </button>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-2">
                  <div className="flex gap-1 border rounded-lg p-0.5 bg-white text-xs">
                    {(["ALL", "COLOR", "SIZE", "TEXT", "SELECT", "CUSTOM"] as const).map((t) => {
                      const lbl: Record<string, string> = { ALL: "Alle", COLOR: "Farve", SIZE: "Str.", TEXT: "Tekst", SELECT: "Valg", CUSTOM: "Custom" };
                      return (
                        <button key={t} type="button" onClick={() => setLibraryFilterType(t)}
                          className={`px-2 py-1 rounded-md transition ${libraryFilterType === t ? "bg-secondary text-white" : "hover:bg-gray-100"}`}>
                          {lbl[t]}
                        </button>
                      );
                    })}
                  </div>
                  {Array.from(new Set(libraryTemplates.flatMap((t) => t.tags))).sort().map((tag) => (
                    <button key={tag} type="button" onClick={() => setLibraryFilterTag(libraryFilterTag === tag ? null : tag)}
                      className={`px-2 py-1 text-xs border rounded-full transition ${
                        libraryFilterTag === tag ? "bg-secondary text-white border-secondary" : "border-gray-300 hover:border-secondary"
                      }`}>
                      {tag}
                    </button>
                  ))}
                </div>

                {/* Template list */}
                {libraryLoading && <p className="text-xs text-gray-400">Henter skabeloner…</p>}
                {!libraryLoading && libraryTemplates.length === 0 && (
                  <p className="text-xs text-gray-400">Ingen skabeloner oprettet endnu.</p>
                )}
                <div className="space-y-2">
                  {libraryTemplates
                    .filter((t) => {
                      if (libraryFilterType !== "ALL" && t.type !== libraryFilterType) return false;
                      if (libraryFilterTag && !t.tags.includes(libraryFilterTag)) return false;
                      // Disable if COLOR or SIZE already present
                      const alreadyHas = (t.type === "COLOR" || t.type === "SIZE") && optionGroups.some((g) => g.type === t.type);
                      return !alreadyHas;
                    })
                    .map((t) => {
                      const typeBadge: Record<string, string> = {
                        COLOR: "bg-pink-100 text-pink-700", SIZE: "bg-blue-100 text-blue-700",
                        TEXT: "bg-yellow-100 text-yellow-700", SELECT: "bg-purple-100 text-purple-700", CUSTOM: "bg-gray-100 text-gray-700",
                      };
                      const typeLabel: Record<string, string> = {
                        COLOR: "Farve", SIZE: "Størrelse", TEXT: "Tekst", SELECT: "Vælg", CUSTOM: "Custom",
                      };
                      return (
                        <div key={t.id} className="flex items-center gap-3 bg-white border rounded-lg px-3 py-2">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${typeBadge[t.type]}`}>
                            {typeLabel[t.type]}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{t.name}</p>
                            {t.values.length > 0 && (
                              <p className="text-xs text-gray-400 truncate">{t.values.map((v) => v.label).join(" · ")}</p>
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
                      );
                    })}
                </div>
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
                    return [...prev, { colorValueKey: "", sizeValueKey: sizeKey, stock: 0, itemNumber: "", itemNumberOverride: false, ...patch }];
                  });
                }}
              />
            )}
          </div>
        )}

        {/* ── Legacy color variant UI ──────────────────────────────────────── */}
        {(!useOptionGroups || hasLegacyColors) && (
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
        <div className="flex gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Gebyr (kr)</label>
            <input type="number" min="0" step="0.01" value={group.feeKr}
              onChange={(e) => onUpdate({ feeKr: e.target.value })}
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
        <p className="text-sm font-medium text-gray-700">Lager &amp; varenumre</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-gray-500">
              <th className="px-3 py-2 text-left font-medium text-xs">Farve</th>
              {sizeGroup.values.map((sv) => (
                <th key={sv._key} className="px-3 py-2 text-center font-medium text-xs min-w-[90px]">{sv.label}</th>
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
                            onChange={(e) => onUpdateCell(cv._key, sv._key, { stock: parseInt(e.target.value) || 0 })}
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
                    onChange={(e) => onUpdateCell(sv._key, { stock: parseInt(e.target.value) || 0 })}
                    className="w-24 border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-secondary"
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
                              <input type="number" min="0" value={sku.stock} onChange={(e) => onUpdateColorSku(cvIdx, sku.size, { stock: parseInt(e.target.value) || 0 })}
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
                        <input type="number" min="0" value={sku.stock} onChange={(e) => onUpdateSku(sku.size, { stock: parseInt(e.target.value) || 0 })}
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
