"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { slugify, formatPrice } from "@/lib/utils";
import { X, GripVertical, ChevronUp, ChevronDown } from "lucide-react";
import { TipTapEditor } from "@/components/admin/TipTapEditor";

type ProductResult = {
  id: string;
  name: string;
  images: string[];
  price: number;
  slug: string;
  skus: { costPrice: number | null }[];
};

type ItemRow = {
  _key: string;
  productId: string;
  productName: string;
  productImage?: string;
  label: string;
  position: number;
  avgCostOre: number | null;
};

type PakketilbudData = {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  images: string[];
  published: boolean;
  featured: boolean;
  position: number;
  items: {
    id: string;
    productId: string;
    label: string | null;
    position: number;
    avgCostOre?: number | null;
    product: { id: string; name: string; images: string[] };
  }[];
};

let _keySeq = 0;
function nextKey() { return `k${++_keySeq}`; }

export function PakketilbudForm({ pakketilbud }: { pakketilbud?: PakketilbudData }) {
  const router = useRouter();
  const isEdit = !!pakketilbud;

  const [name, setName] = useState(pakketilbud?.name ?? "");
  const [slug, setSlug] = useState(pakketilbud?.slug ?? "");
  const [slugManual, setSlugManual] = useState(isEdit);
  const [description, setDescription] = useState(pakketilbud?.description ?? "");
  const [priceKr, setPriceKr] = useState(pakketilbud ? (pakketilbud.price / 100).toFixed(2) : "");
  const [salePriceKr, setSalePriceKr] = useState(
    (pakketilbud as typeof pakketilbud & { salePrice?: number | null })?.salePrice
      ? ((pakketilbud as typeof pakketilbud & { salePrice: number }).salePrice / 100).toFixed(2)
      : ""
  );
  const [salePriceStart, setSalePriceStart] = useState(
    (pakketilbud as typeof pakketilbud & { salePriceStart?: string | Date | null })?.salePriceStart
      ? new Date((pakketilbud as typeof pakketilbud & { salePriceStart: string | Date }).salePriceStart).toISOString().slice(0, 10)
      : ""
  );
  const [salePriceEnd, setSalePriceEnd] = useState(
    (pakketilbud as typeof pakketilbud & { salePriceEnd?: string | Date | null })?.salePriceEnd
      ? new Date((pakketilbud as typeof pakketilbud & { salePriceEnd: string | Date }).salePriceEnd).toISOString().slice(0, 10)
      : ""
  );
  const [images, setImages] = useState<string[]>(pakketilbud?.images ?? []);
  const [published, setPublished] = useState(pakketilbud?.published ?? true);
  const [featured, setFeatured] = useState(pakketilbud?.featured ?? false);
  const [position, setPosition] = useState(String(pakketilbud?.position ?? 0));

  const [items, setItems] = useState<ItemRow[]>(
    (pakketilbud?.items ?? []).map((it, i) => ({
      _key: nextKey(),
      productId: it.productId,
      productName: it.product.name,
      productImage: it.product.images[0],
      label: it.label ?? "",
      position: it.position ?? i,
      avgCostOre: it.avgCostOre ?? null,
    }))
  );

  const [productSearch, setProductSearch] = useState("");
  const [productResults, setProductResults] = useState<ProductResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [saving, setSaving] = useState(false);

  const costSummary = useMemo(() => {
    if (items.length === 0) return null;
    const allHaveCost = items.every((it) => it.avgCostOre !== null);
    const someHaveCost = items.some((it) => it.avgCostOre !== null);
    if (!someHaveCost) return null;
    const totalCostOre = allHaveCost
      ? items.reduce((sum, it) => sum + it.avgCostOre!, 0)
      : null;
    const priceOre = Math.round(parseFloat(priceKr.replace(",", ".")) * 100) || null;
    const marginOre = totalCostOre !== null && priceOre !== null ? priceOre - totalCostOre : null;
    const marginPct = marginOre !== null && priceOre ? (marginOre / priceOre) * 100 : null;
    return { totalCostOre, allHaveCost, marginOre, marginPct };
  }, [items, priceKr]);

  // Cloudinary widget
  const widgetRef = useRef<{ open: () => void } | null>(null);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://upload-widget.cloudinary.com/global/all.js";
    script.async = true;
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

  function openCloudinaryWidget() {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_UPLOAD_PRESET;
    if (!cloudName || !uploadPreset) {
      toast.error("Cloudinary er ikke konfigureret");
      return;
    }
    if (!widgetRef.current) {
      // @ts-expect-error cloudinary global
      widgetRef.current = window.cloudinary?.createUploadWidget(
        { cloudName, uploadPreset, multiple: true, resourceType: "image", folder: "vbk-pakketilbud", clientAllowedFormats: ["jpg", "jpeg", "png", "webp"], maxFileSize: 5000000 },
        (error: unknown, result: { event: string; info: { secure_url: string } }) => {
          if (error) { toast.error("Upload fejlede"); return; }
          if (result.event === "success") {
            setImages((prev) => [...prev, result.info.secure_url]);
          }
        }
      );
    }
    widgetRef.current?.open();
  }

  // Product search
  useEffect(() => {
    if (!productSearch.trim()) {
      setProductResults([]);
      return;
    }
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/products?q=${encodeURIComponent(productSearch)}`);
        const data = await res.json();
        setProductResults(data.slice(0, 8));
      } catch {
        // ignore
      } finally {
        setSearching(false);
      }
    }, 300);
  }, [productSearch]);

  function addProduct(product: ProductResult) {
    const skusWithCost = product.skus?.filter((s) => s.costPrice !== null) ?? [];
    const avgCostOre = skusWithCost.length > 0
      ? Math.round(skusWithCost.reduce((sum, s) => sum + s.costPrice!, 0) / skusWithCost.length)
      : null;
    setItems((prev) => [
      ...prev,
      {
        _key: nextKey(),
        productId: product.id,
        productName: product.name,
        productImage: product.images[0],
        label: "",
        position: prev.length,
        avgCostOre,
      },
    ]);
    setProductSearch("");
    setProductResults([]);
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((it) => it._key !== key).map((it, i) => ({ ...it, position: i })));
  }

  function moveItem(key: string, dir: -1 | 1) {
    setItems((prev) => {
      const idx = prev.findIndex((it) => it._key === key);
      if (idx < 0) return prev;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr.map((it, i) => ({ ...it, position: i }));
    });
  }

  function updateLabel(key: string, label: string) {
    setItems((prev) => prev.map((it) => it._key === key ? { ...it, label } : it));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error("Navn er påkrævet"); return; }
    if (!slug.trim()) { toast.error("Slug er påkrævet"); return; }
    const price = Math.round(parseFloat(priceKr.replace(",", ".")) * 100);
    if (isNaN(price) || price < 0) { toast.error("Ugyldig pris"); return; }
    if (items.length === 0) { toast.error("Tilføj mindst ét produkt"); return; }

    setSaving(true);
    try {
      const salePriceOre = salePriceKr ? Math.round(parseFloat(salePriceKr.replace(",", ".")) * 100) : null;
      const payload = {
        name,
        slug,
        description,
        price,
        salePrice: salePriceOre,
        salePriceStart: salePriceStart || null,
        salePriceEnd: salePriceEnd || null,
        images,
        published,
        featured,
        position: parseInt(position) || 0,
        items: items.map((it, i) => ({
          productId: it.productId,
          label: it.label || null,
          position: i,
        })),
      };

      const res = await fetch(
        isEdit ? `/api/pakketilbud/${pakketilbud!.id}` : "/api/pakketilbud",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Fejl ved gemning");
      }

      toast.success(isEdit ? "Pakketilbud opdateret" : "Pakketilbud oprettet");
      router.push("/admin/pakketilbud");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fejl ved gemning");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-2xl">
      {/* Basic fields */}
      <section className="border rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-gray-700">Grundoplysninger</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Navn</label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugManual) setSlug(slugify(e.target.value));
            }}
            className="w-full border rounded-lg px-3 py-2 text-sm"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Slug (URL)</label>
          <input
            type="text"
            value={slug}
            onChange={(e) => { setSlug(e.target.value); setSlugManual(true); }}
            className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Beskrivelse</label>
          <TipTapEditor
            content={description}
            onChange={setDescription}
            placeholder="Kort beskrivelse af pakketilbuddet..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Pris (kr, ekskl. moms)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={priceKr}
            onChange={(e) => setPriceKr(e.target.value)}
            className="w-48 border rounded-lg px-3 py-2 text-sm"
            required
          />
        </div>

        {/* ── Tilbudspris ────────────────────────────────────────────────── */}
        <div className="border rounded-lg p-4 space-y-3 bg-amber-50">
          <p className="text-sm font-medium text-gray-700">Tidsbestemt tilbud (valgfrit)</p>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tilbudspris (kr, ekskl. moms)</label>
              <input type="number" min="0" step="0.01" value={salePriceKr} onChange={(e) => setSalePriceKr(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
                placeholder="499.00"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tilbud fra</label>
              <input type="date" value={salePriceStart} onChange={(e) => setSalePriceStart(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tilbud til</label>
              <input type="date" value={salePriceEnd} onChange={(e) => setSalePriceEnd(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500">Tilbudsprisen overskriver fanklubsrabat og rabatkoder i perioden.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sorteringsposition</label>
          <input
            type="number"
            min="0"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            className="w-32 border rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="w-4 h-4" />
            Publiceret
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="w-4 h-4" />
            Fremhævet
          </label>
        </div>
      </section>

      {/* Images */}
      <section className="border rounded-xl p-5 space-y-3">
        <h2 className="font-semibold text-gray-700">Billeder</h2>
        <div className="flex flex-wrap gap-2">
          {images.map((url, i) => (
            <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition"
              >
                <X size={12} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={openCloudinaryWidget}
            className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 hover:border-primary hover:text-primary transition text-2xl"
          >
            +
          </button>
        </div>
      </section>

      {/* Products / items */}
      <section className="border rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-gray-700">Produkter i pakken</h2>

        {/* Items list */}
        {items.length > 0 && (
          <ul className="space-y-2">
            {items.map((item, idx) => (
              <li key={item._key} className="flex items-center gap-2 border rounded-lg p-3 bg-gray-50">
                <GripVertical size={14} className="text-gray-300 shrink-0" />
                {item.productImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.productImage} alt="" className="w-10 h-10 object-cover rounded shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-medium truncate">{item.productName}</p>
                    {item.avgCostOre !== null
                      ? <span className="text-xs text-gray-400 shrink-0">kostpris {formatPrice(item.avgCostOre)}</span>
                      : <span className="text-xs text-orange-400 shrink-0">ingen kostpris</span>
                    }
                  </div>
                  <input
                    type="text"
                    placeholder="Valgfri label (f.eks. &quot;Din trøje&quot;)"
                    value={item.label}
                    onChange={(e) => updateLabel(item._key, e.target.value)}
                    className="mt-1 w-full text-xs border rounded px-2 py-1"
                  />
                </div>
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button type="button" onClick={() => moveItem(item._key, -1)} disabled={idx === 0} className="text-gray-400 hover:text-gray-700 disabled:opacity-20">
                    <ChevronUp size={14} />
                  </button>
                  <button type="button" onClick={() => moveItem(item._key, 1)} disabled={idx === items.length - 1} className="text-gray-400 hover:text-gray-700 disabled:opacity-20">
                    <ChevronDown size={14} />
                  </button>
                </div>
                <button type="button" onClick={() => removeItem(item._key)} className="text-gray-400 hover:text-red-500 shrink-0">
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Cost summary */}
        {costSummary && (
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm space-y-1">
            <div className="flex justify-between text-gray-600">
              <span>Total kostpris ({costSummary.allHaveCost ? "alle produkter" : "delvise data"})</span>
              <span className="font-medium tabular-nums">
                {costSummary.totalCostOre !== null ? formatPrice(costSummary.totalCostOre) : "—"}
              </span>
            </div>
            {costSummary.marginOre !== null && (
              <div className="flex justify-between">
                <span className="text-gray-600">Avance (ekskl. moms)</span>
                <span className={`font-semibold tabular-nums ${costSummary.marginOre >= 0 ? "text-green-600" : "text-red-500"}`}>
                  {formatPrice(costSummary.marginOre)}
                  {costSummary.marginPct !== null && (
                    <span className="ml-1 font-normal text-xs text-gray-400">({costSummary.marginPct.toFixed(1)} %)</span>
                  )}
                </span>
              </div>
            )}
            {!costSummary.allHaveCost && (
              <p className="text-xs text-orange-500">Nogle produkter mangler kostpris — avance kan ikke beregnes præcist.</p>
            )}
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Søg efter produkt..."
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
          {(productResults.length > 0 || searching) && (
            <ul className="absolute z-10 top-full left-0 right-0 bg-white border rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto">
              {searching && <li className="px-3 py-2 text-sm text-gray-400">Søger...</li>}
              {productResults.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => addProduct(p)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-left"
                  >
                    {p.images[0] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.images[0]} alt="" className="w-8 h-8 object-cover rounded" />
                    )}
                    <span>{p.name}</span>
                    <span className="ml-auto text-xs text-gray-400">{(p.price / 100).toFixed(2)} kr</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="bg-primary text-secondary font-bold px-6 py-2.5 rounded-xl hover:bg-primary-dark transition disabled:opacity-60 text-sm"
        >
          {saving ? "Gemmer..." : isEdit ? "Gem ændringer" : "Opret pakketilbud"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/pakketilbud")}
          className="px-6 py-2.5 rounded-xl border text-sm hover:bg-gray-50 transition"
        >
          Annuller
        </button>
      </div>
    </form>
  );
}
