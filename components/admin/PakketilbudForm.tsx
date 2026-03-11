"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { slugify } from "@/lib/utils";
import { X, GripVertical, ChevronUp, ChevronDown } from "lucide-react";

type ProductResult = {
  id: string;
  name: string;
  images: string[];
  price: number;
  slug: string;
};

type ItemRow = {
  _key: string;
  productId: string;
  productName: string;
  productImage?: string;
  label: string;
  position: number;
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
    }))
  );

  const [productSearch, setProductSearch] = useState("");
  const [productResults, setProductResults] = useState<ProductResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [saving, setSaving] = useState(false);

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
    setItems((prev) => [
      ...prev,
      {
        _key: nextKey(),
        productId: product.id,
        productName: product.name,
        productImage: product.images[0],
        label: "",
        position: prev.length,
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
      const payload = {
        name,
        slug,
        description,
        price,
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
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Pris (kr, inkl. moms)</label>
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
                  <p className="text-sm font-medium truncate">{item.productName}</p>
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
