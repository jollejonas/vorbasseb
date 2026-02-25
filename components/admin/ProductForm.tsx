"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { slugify } from "@/lib/utils";
import type { Product, SKU, Category, ClubRole } from "@prisma/client";

type ProductWithSkus = Product & { skus: SKU[]; category: Category | null };
type SkuRow = { id?: string; size: string; stock: number };

const ADULT_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const KIDS_SIZES = ["116", "128", "140", "152", "164"];
const ALL_SIZES = [...ADULT_SIZES, ...KIDS_SIZES];

export function ProductForm({ product }: { product?: ProductWithSkus }) {
  const router = useRouter();
  const isEdit = !!product;

  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [slugManual, setSlugManual] = useState(isEdit);
  const [categoryId, setCategoryId] = useState<string>(product?.categoryId ?? "");
  const [categories, setCategories] = useState<Category[]>([]);
  const [priceKr, setPriceKr] = useState(
    product ? (product.price / 100).toFixed(2) : ""
  );
  const [customizationFeeKr, setCustomizationFeeKr] = useState(
    product?.customizationFee ? (product.customizationFee / 100).toFixed(2) : ""
  );
  const [membersOnly, setMembersOnly] = useState(product?.membersOnly ?? false);
  const [membersEarlyAccess, setMembersEarlyAccess] = useState(product?.membersEarlyAccess ?? false);
  const [clubRoleRequired, setClubRoleRequired] = useState<ClubRole | "">(product?.clubRoleRequired ?? "");
  const [customizationLabel, setCustomizationLabel] = useState(product?.customizationLabel ?? "");
  const [customizationShowNumber, setCustomizationShowNumber] = useState(product?.customizationShowNumber ?? true);
  const [published, setPublished] = useState(product?.published ?? true);
  const [featured, setFeatured] = useState(product?.featured ?? false);
  const [description, setDescription] = useState(product?.description ?? "");
  const [images, setImages] = useState<string[]>(product?.images ?? []);
  const [skus, setSkus] = useState<SkuRow[]>(
    product?.skus.map((s) => ({ id: s.id, size: s.size, stock: s.stock })) ?? []
  );
  const [saving, setSaving] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const widgetRef = useRef<any>(null);

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
    const script = document.createElement("script");
    script.src = "https://upload-widget.cloudinary.com/global/all.js";
    script.async = true;
    document.head.appendChild(script);
    return () => {
      document.head.removeChild(script);
    };
  }, []);

  function openCloudinaryWidget() {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_UPLOAD_PRESET;
    if (!cloudName || !uploadPreset) {
      toast.error("Cloudinary er ikke konfigureret (mangler env-variabler)");
      return;
    }
    if (!widgetRef.current) {
      // @ts-expect-error cloudinary global from CDN
      widgetRef.current = window.cloudinary?.createUploadWidget(
        {
          cloudName,
          uploadPreset,
          multiple: true,
          resourceType: "image",
          folder: "vbk-produkter",
          clientAllowedFormats: ["jpg", "jpeg", "png", "webp"],
          maxFileSize: 5000000,
        },
        (
          error: unknown,
          result: { event: string; info: { secure_url: string } }
        ) => {
          if (error) {
            toast.error("Upload fejlede");
            return;
          }
          if (result.event === "success") {
            setImages((prev) => [...prev, result.info.secure_url]);
          }
        }
      );
    }
    widgetRef.current?.open();
  }

  function addSize(size: string) {
    if (skus.find((s) => s.size === size)) return;
    setSkus((prev) => [...prev, { size, stock: 0 }]);
  }

  function removeSize(size: string) {
    setSkus((prev) => prev.filter((s) => s.size !== size));
  }

  function updateStock(size: string, stock: number) {
    setSkus((prev) => prev.map((s) => (s.size === size ? { ...s, stock } : s)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const priceVal = parseFloat(priceKr);
    if (isNaN(priceVal) || priceVal < 0) {
      toast.error("Ugyldig pris");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name,
        slug,
        categoryId: categoryId || null,
        price: Math.round(priceVal * 100),
        customizationFee: customizationFeeKr
          ? Math.round(parseFloat(customizationFeeKr) * 100)
          : null,
        membersOnly,
        membersEarlyAccess,
        clubRoleRequired: clubRoleRequired || null,
        customizationLabel: customizationLabel || null,
        customizationShowNumber,
        published,
        featured,
        description,
        images,
        skus: skus.map(({ id, size, stock }) => ({ id, size, stock })),
      };

      const url = isEdit ? `/api/products/${product.id}` : "/api/products";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
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

  const unavailableSizes = skus.map((s) => s.size);

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-2xl">
      {/* Basic info */}
      <section className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Navn <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
            placeholder="f.eks. Spillertrøje 2025"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Slug <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugManual(true);
            }}
            required
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary font-mono"
          />
          <p className="text-xs text-gray-400 mt-1">
            URL: /butik/{slug || "..."}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Kategori
          </label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
          >
            <option value="">Ingen kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pris (kr) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={priceKr}
              onChange={(e) => setPriceKr(e.target.value)}
              required
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
              placeholder="299.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Personaliseringsgebyr (kr)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={customizationFeeKr}
              onChange={(e) => setCustomizationFeeKr(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
              placeholder="75.00"
            />
            <p className="text-xs text-gray-400 mt-1">Lad stå tomt hvis ikke relevant</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Kræver klubrolle
          </label>
          <select
            value={clubRoleRequired}
            onChange={(e) => setClubRoleRequired(e.target.value as ClubRole | "")}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
          >
            <option value="">Ingen begrænsning (synlig for alle)</option>
            <option value="PLAYER">Kun spillere (PLAYER)</option>
            <option value="TRAINER">Kun trænere (TRAINER)</option>
          </select>
          <p className="text-xs text-gray-400 mt-1">
            Produkter med rollebegrænsning vises ikke i den almindelige butik
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              PersonaliseringsLabel
            </label>
            <input
              type="text"
              value={customizationLabel}
              onChange={(e) => setCustomizationLabel(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
              placeholder="f.eks. Initialer eller Trøjenavn"
            />
            <p className="text-xs text-gray-400 mt-1">
              Overskrift på personaliseringsfeltet (bruges kun hvis gebyr er sat)
            </p>
          </div>
          <div className="flex items-start pt-6">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={customizationShowNumber}
                onChange={(e) => setCustomizationShowNumber(e.target.checked)}
                className="w-4 h-4 accent-secondary"
              />
              <span className="text-sm">Vis nummerfelt</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Beskrivelse
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary resize-y"
            placeholder="Kort beskrivelse af produktet..."
          />
        </div>
      </section>

      {/* Flags */}
      <section>
        <p className="text-sm font-medium text-gray-700 mb-3">Indstillinger</p>
        <div className="flex flex-wrap gap-6">
          {(
            [
              { label: "Udgivet", checked: published, set: setPublished },
              { label: "Fremhævet på forsiden", checked: featured, set: setFeatured },
              { label: "Kun for medlemmer", checked: membersOnly, set: setMembersOnly },
              { label: "Tidlig adgang for medlemmer", checked: membersEarlyAccess, set: setMembersEarlyAccess },
            ] as { label: string; checked: boolean; set: (v: boolean) => void }[]
          ).map(({ label, checked, set }) => (
            <label
              key={label}
              className="flex items-center gap-2 cursor-pointer select-none"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => set(e.target.checked)}
                className="w-4 h-4 accent-secondary"
              />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Images */}
      <section>
        <p className="text-sm font-medium text-gray-700 mb-2">Billeder</p>
        <div className="flex flex-wrap gap-3 mb-3">
          {images.map((url, i) => (
            <div
              key={i}
              className="relative w-20 h-20 rounded-lg overflow-hidden border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                className="absolute top-0.5 right-0.5 bg-white/90 rounded-full w-5 h-5 text-xs text-red-600 hover:bg-white leading-none font-bold"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={openCloudinaryWidget}
            className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-secondary hover:text-secondary transition gap-1"
          >
            <span className="text-2xl leading-none">+</span>
            <span className="text-xs">Upload</span>
          </button>
        </div>
        <p className="text-xs text-gray-400">
          Første billede bruges som thumbnail. Max 5 MB per billede.
        </p>
      </section>

      {/* SKUs */}
      <section>
        <p className="text-sm font-medium text-gray-700 mb-2">
          Størrelser &amp; lager
        </p>

        <div className="flex flex-wrap gap-2 mb-3">
          <span className="text-xs text-gray-500 self-center mr-1">Tilføj størrelse:</span>
          {ALL_SIZES.filter((sz) => !unavailableSizes.includes(sz)).map((sz) => (
            <button
              key={sz}
              type="button"
              onClick={() => addSize(sz)}
              className="px-2.5 py-1 text-xs border rounded-lg hover:border-secondary hover:text-secondary transition"
            >
              {sz}
            </button>
          ))}
          {ALL_SIZES.every((sz) => unavailableSizes.includes(sz)) && (
            <span className="text-xs text-gray-400 italic">Alle størrelser tilføjet</span>
          )}
        </div>

        {skus.length > 0 ? (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left px-4 py-2 font-medium text-gray-600 text-xs">
                    Størrelse
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600 text-xs">
                    Lager (stk)
                  </th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {skus.map((sku) => (
                  <tr key={sku.size}>
                    <td className="px-4 py-2 font-mono font-semibold text-sm">
                      {sku.size}
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min="0"
                        value={sku.stock}
                        onChange={(e) =>
                          updateStock(sku.size, parseInt(e.target.value) || 0)
                        }
                        className="w-24 border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => removeSize(sku.size)}
                        className="text-xs text-red-400 hover:text-red-600 underline"
                      >
                        Fjern
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic border rounded-lg px-4 py-3">
            Ingen størrelser tilføjet endnu. Klik på en størrelse ovenfor for at tilføje.
          </p>
        )}
      </section>

      {/* Actions */}
      <div className="flex gap-3 pt-2 border-t">
        <button
          type="submit"
          disabled={saving}
          className="bg-primary text-secondary font-bold px-6 py-2 rounded-xl hover:bg-primary-dark transition text-sm disabled:opacity-50"
        >
          {saving ? "Gemmer..." : isEdit ? "Gem ændringer" : "Opret produkt"}
        </button>
        <a
          href="/admin/produkter"
          className="px-6 py-2 rounded-xl border text-sm text-gray-600 hover:border-gray-400 transition"
        >
          Annuller
        </a>
      </div>
    </form>
  );
}
