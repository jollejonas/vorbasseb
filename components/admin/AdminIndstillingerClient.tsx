"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { SiteSetting, HeroSlide, NewsPost, Product } from "@prisma/client";

type HeroSlideWithRefs = HeroSlide & {
  overrideNews: Pick<NewsPost, "id" | "title"> | null;
  overrideProduct: Pick<Product, "id" | "name"> | null;
};

type Props = {
  settings: SiteSetting[];
  slides: HeroSlideWithRefs[];
  allNews: Pick<NewsPost, "id" | "title" | "slug">[];
  allProducts: Pick<Product, "id" | "name" | "slug">[];
};

const SETTING_LABELS: Record<string, string> = {
  vat_rate: "Momssats (%)",
  footer_phone: "Telefon (footer)",
  footer_email: "E-mail (footer)",
  shipping_flat_ore: "Fast fragtgebyr (øre)",
  shipping_free_ore: "Gratis fragt fra (øre)",
  member_discount_pct: "Fanklubsrabat (%)",
  delivery_banner: "Leveringsbanner tekst (tom = skjult)",
};

const SETTING_KEYS = Object.keys(SETTING_LABELS);

const EMAIL_TEMPLATE_KEYS = [
  "email_order_subject",
  "email_order_body",
  "email_shipping_subject",
  "email_shipping_body",
] as const;

const EMAIL_VARS: Record<string, string[]> = {
  email_order_body: ["{{customerName}}", "{{items}}", "{{total}}"],
  email_shipping_body: ["{{customerName}}", "{{orderId}}", "{{trackingNumber}}", "{{items}}"],
};

const SLIDE_TYPE_LABELS: Record<string, string> = {
  CUSTOM: "Brugerdefineret",
  LATEST_NEWS: "Seneste nyhed",
  LATEST_PRODUCT: "Seneste produkt",
};

const SLIDE_TYPE_COLORS: Record<string, string> = {
  CUSTOM: "bg-blue-100 text-blue-700",
  LATEST_NEWS: "bg-purple-100 text-purple-700",
  LATEST_PRODUCT: "bg-amber-100 text-amber-700",
};

export function AdminIndstillingerClient({ settings, slides: initialSlides, allNews, allProducts }: Props) {
  const router = useRouter();

  // ── Settings form state ──────────────────────────────────────────────────
  const [settingsMap, setSettingsMap] = useState<Record<string, string>>(
    Object.fromEntries(settings.map((s) => [s.key, s.value]))
  );
  const [savingSettings, setSavingSettings] = useState(false);

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const payload = SETTING_KEYS.map((key) => ({ key, value: settingsMap[key] ?? "" }));
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: payload }),
      });
      if (!res.ok) throw new Error("Fejl ved gem");
      toast.success("Indstillinger gemt");
      router.refresh();
    } catch {
      toast.error("Noget gik galt");
    } finally {
      setSavingSettings(false);
    }
  }

  // ── Email template state ─────────────────────────────────────────────────
  const [emailTemplates, setEmailTemplates] = useState<Record<string, string>>(
    Object.fromEntries(settings.map((s) => [s.key, s.value]))
  );
  const [savingTemplates, setSavingTemplates] = useState(false);

  async function handleSaveTemplates(e: React.FormEvent) {
    e.preventDefault();
    setSavingTemplates(true);
    try {
      const payload = EMAIL_TEMPLATE_KEYS.map((key) => ({ key, value: emailTemplates[key] ?? "" }));
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: payload }),
      });
      if (!res.ok) throw new Error();
      toast.success("E-mail skabeloner gemt");
    } catch {
      toast.error("Noget gik galt");
    } finally {
      setSavingTemplates(false);
    }
  }

  // ── Hero slides state ───────────────────────────────────────────────────
  const [slides, setSlides] = useState<HeroSlideWithRefs[]>(initialSlides);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [slideForm, setSlideForm] = useState<Partial<HeroSlide>>({});
  const [addingSlide, setAddingSlide] = useState(false);

  function openEdit(slide: HeroSlideWithRefs) {
    setEditingId(slide.id);
    setSlideForm({ ...slide });
  }

  function closeEdit() {
    setEditingId(null);
    setSlideForm({});
  }

  async function handleSaveSlide(id: string) {
    try {
      const res = await fetch(`/api/hero-slides/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(slideForm),
      });
      if (!res.ok) throw new Error();
      toast.success("Slide gemt");
      closeEdit();
      router.refresh();
      const updated: HeroSlideWithRefs = await res.json();
      setSlides((prev) => prev.map((s) => (s.id === id ? updated : s)));
    } catch {
      toast.error("Noget gik galt");
    }
  }

  async function handleDeleteSlide(id: string) {
    if (!confirm("Slet dette slide?")) return;
    try {
      const res = await fetch(`/api/hero-slides/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Slide slettet");
      const remaining = slides.filter((s) => s.id !== id).map((s, i) => ({ ...s, position: i }));
      setSlides(remaining);
      await Promise.all(
        remaining.map((s) =>
          fetch(`/api/hero-slides/${s.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(s),
          })
        )
      );
      router.refresh();
    } catch {
      toast.error("Noget gik galt");
    }
  }

  async function handleToggleEnabled(slide: HeroSlideWithRefs) {
    try {
      const res = await fetch(`/api/hero-slides/${slide.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...slide, enabled: !slide.enabled }),
      });
      if (!res.ok) throw new Error();
      const updated: HeroSlideWithRefs = await res.json();
      setSlides((prev) => prev.map((s) => (s.id === slide.id ? updated : s)));
      toast.success(updated.enabled ? "Slide aktiveret" : "Slide deaktiveret");
    } catch {
      toast.error("Noget gik galt");
    }
  }

  async function handleMove(index: number, dir: "up" | "down") {
    const newSlides = [...slides];
    const target = dir === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= newSlides.length) return;
    [newSlides[index], newSlides[target]] = [newSlides[target], newSlides[index]];
    const reindexed = newSlides.map((s, i) => ({ ...s, position: i }));
    setSlides(reindexed);
    await Promise.all(
      [reindexed[index], reindexed[target]].map((s) =>
        fetch(`/api/hero-slides/${s.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(s),
        })
      )
    );
  }

  async function handleAddSlide() {
    setAddingSlide(true);
    try {
      const res = await fetch("/api/hero-slides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "CUSTOM", position: slides.length }),
      });
      if (!res.ok) throw new Error();
      const created: HeroSlideWithRefs = await res.json();
      setSlides((prev) => [...prev, created]);
      openEdit(created);
      toast.success("Nyt slide oprettet");
    } catch {
      toast.error("Noget gik galt");
    } finally {
      setAddingSlide(false);
    }
  }

  return (
    <div className="space-y-10">
      {/* ── Section A: Site settings ──────────────────────────────────────── */}
      <section id="generelt">
        <h2 className="text-xl font-bold mb-5">Generelle indstillinger</h2>
        <form onSubmit={handleSaveSettings} className="max-w-lg space-y-4">
          {SETTING_KEYS.map((key) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {SETTING_LABELS[key]}
              </label>
              <input
                type="text"
                value={settingsMap[key] ?? ""}
                onChange={(e) => setSettingsMap((prev) => ({ ...prev, [key]: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
              />
            </div>
          ))}
          <div className="pt-2">
            <button
              type="submit"
              disabled={savingSettings}
              className="bg-primary text-secondary font-bold px-6 py-2 rounded-xl hover:bg-primary-dark transition text-sm disabled:opacity-50"
            >
              {savingSettings ? "Gemmer..." : "Gem indstillinger"}
            </button>
          </div>
        </form>
      </section>

      {/* ── Section B: Hero slides ────────────────────────────────────────── */}
      <section id="hero-carousel">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold">Hero-carousel slides</h2>
          <button
            onClick={handleAddSlide}
            disabled={addingSlide}
            className="bg-primary text-secondary font-bold px-4 py-2 rounded-xl hover:bg-primary-dark transition text-sm disabled:opacity-50"
          >
            {addingSlide ? "Opretter..." : "+ Tilføj slide"}
          </button>
        </div>

        {slides.length === 0 ? (
          <p className="text-sm text-gray-400 italic">
            Ingen slides endnu. Klik &quot;+ Tilføj slide&quot; for at oprette det første.
          </p>
        ) : (
          <div className="space-y-3">
            {slides.map((slide, index) => (
              <div key={slide.id} className="border rounded-xl overflow-hidden">
                {/* Slide row */}
                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50">
                  {/* Position controls */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => handleMove(index, "up")}
                      disabled={index === 0}
                      className="text-gray-400 hover:text-gray-700 disabled:opacity-30 text-xs leading-none"
                      aria-label="Flyt op"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => handleMove(index, "down")}
                      disabled={index === slides.length - 1}
                      className="text-gray-400 hover:text-gray-700 disabled:opacity-30 text-xs leading-none"
                      aria-label="Flyt ned"
                    >
                      ▼
                    </button>
                  </div>

                  {/* Type badge */}
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${SLIDE_TYPE_COLORS[slide.type] ?? "bg-gray-100"}`}>
                    {SLIDE_TYPE_LABELS[slide.type] ?? slide.type}
                  </span>

                  {/* Slide summary */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {slide.heading ?? (slide.type === "LATEST_NEWS" ? "Auto: seneste nyhed" : slide.type === "LATEST_PRODUCT" ? "Auto: seneste produkt" : "Intet overskrift")}
                    </p>
                    {slide.type === "LATEST_NEWS" && slide.overrideNews && (
                      <p className="text-xs text-gray-500 truncate">Fastlåst: {slide.overrideNews.title}</p>
                    )}
                    {slide.type === "LATEST_PRODUCT" && slide.overrideProduct && (
                      <p className="text-xs text-gray-500 truncate">Fastlåst: {slide.overrideProduct.name}</p>
                    )}
                  </div>

                  {/* Enabled toggle */}
                  <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={slide.enabled}
                      onChange={() => handleToggleEnabled(slide)}
                      className="w-4 h-4 accent-secondary"
                    />
                    <span className="text-xs text-gray-600">Aktiv</span>
                  </label>

                  {/* Edit / delete */}
                  <div className="flex gap-2 text-xs shrink-0">
                    <button
                      onClick={() => editingId === slide.id ? closeEdit() : openEdit(slide)}
                      className="text-secondary underline hover:text-secondary-dark"
                    >
                      {editingId === slide.id ? "Luk" : "Rediger"}
                    </button>
                    <button
                      onClick={() => handleDeleteSlide(slide.id)}
                      className="text-red-400 underline hover:text-red-600"
                    >
                      Slet
                    </button>
                  </div>
                </div>

                {/* Inline edit form */}
                {editingId === slide.id && (
                  <div className="px-4 py-4 border-t space-y-4 bg-white">
                    {/* Type select */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                      <select
                        value={slideForm.type ?? "CUSTOM"}
                        onChange={(e) => setSlideForm((f) => ({ ...f, type: e.target.value as HeroSlide["type"] }))}
                        className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
                      >
                        <option value="CUSTOM">Brugerdefineret</option>
                        <option value="LATEST_NEWS">Seneste nyhed</option>
                        <option value="LATEST_PRODUCT">Seneste produkt</option>
                      </select>
                    </div>

                    {/* CUSTOM fields */}
                    {slideForm.type === "CUSTOM" && (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Overskrift</label>
                            <input
                              type="text"
                              value={slideForm.heading ?? ""}
                              onChange={(e) => setSlideForm((f) => ({ ...f, heading: e.target.value }))}
                              className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
                              placeholder="Vorbasse Boldklub"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Underoverskrift</label>
                            <input
                              type="text"
                              value={slideForm.subheading ?? ""}
                              onChange={(e) => setSlideForm((f) => ({ ...f, subheading: e.target.value }))}
                              className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
                              placeholder="Officiel merchandise-butik"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Brødtekst</label>
                          <textarea
                            value={slideForm.body ?? ""}
                            onChange={(e) => setSlideForm((f) => ({ ...f, body: e.target.value }))}
                            rows={2}
                            className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary resize-none"
                            placeholder="Kort beskrivelse..."
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Baggrundsbillede URL</label>
                          <input
                            type="text"
                            value={slideForm.imageUrl ?? ""}
                            onChange={(e) => setSlideForm((f) => ({ ...f, imageUrl: e.target.value }))}
                            className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary font-mono"
                            placeholder="https://..."
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Knaptekst</label>
                            <input
                              type="text"
                              value={slideForm.ctaLabel ?? ""}
                              onChange={(e) => setSlideForm((f) => ({ ...f, ctaLabel: e.target.value }))}
                              className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
                              placeholder="Se butikken"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Knap-URL</label>
                            <input
                              type="text"
                              value={slideForm.ctaHref ?? ""}
                              onChange={(e) => setSlideForm((f) => ({ ...f, ctaHref: e.target.value }))}
                              className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary font-mono"
                              placeholder="/butik"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {/* LATEST_NEWS controls */}
                    {slideForm.type === "LATEST_NEWS" && (
                      <>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Antal nyheder der vises (1–5)
                          </label>
                          <select
                            value={slideForm.newsCount ?? 1}
                            onChange={(e) => setSlideForm((f) => ({ ...f, newsCount: parseInt(e.target.value) }))}
                            className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
                          >
                            {[1, 2, 3, 4, 5].map((n) => (
                              <option key={n} value={n}>{n}</option>
                            ))}
                          </select>
                          <p className="text-xs text-gray-400 mt-1">
                            Genererer automatisk dette antal slides fra de seneste nyheder.
                          </p>
                        </div>
                        {(slideForm.newsCount ?? 1) === 1 && (
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Fastlås til specifik nyhed (valgfrit)
                            </label>
                            <select
                              value={slideForm.overrideNewsId ?? ""}
                              onChange={(e) => setSlideForm((f) => ({ ...f, overrideNewsId: e.target.value || null }))}
                              className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
                            >
                              <option value="">— Brug seneste (automatisk) —</option>
                              {allNews.map((n) => (
                                <option key={n.id} value={n.id}>{n.title}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </>
                    )}

                    {/* LATEST_PRODUCT pin */}
                    {slideForm.type === "LATEST_PRODUCT" && (
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Fastlås til specifikt produkt (valgfrit)
                        </label>
                        <select
                          value={slideForm.overrideProductId ?? ""}
                          onChange={(e) => setSlideForm((f) => ({ ...f, overrideProductId: e.target.value || null }))}
                          className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
                        >
                          <option value="">— Brug seneste (automatisk) —</option>
                          {allProducts.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Overlay opacity (all types) */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Mørklægning af baggrund: {slideForm.overlayOpacity ?? 40}%
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={90}
                        step={5}
                        value={slideForm.overlayOpacity ?? 40}
                        onChange={(e) => setSlideForm((f) => ({ ...f, overlayOpacity: parseInt(e.target.value) }))}
                        className="w-full accent-secondary"
                      />
                      <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                        <span>Lys</span><span>Mørk</span>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => handleSaveSlide(slide.id)}
                        className="bg-primary text-secondary font-bold px-5 py-1.5 rounded-lg text-sm hover:bg-primary-dark transition"
                      >
                        Gem slide
                      </button>
                      <button
                        onClick={closeEdit}
                        className="px-5 py-1.5 rounded-lg border text-sm text-gray-600 hover:border-gray-400 transition"
                      >
                        Annuller
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-400 mt-3">
          Max 5 slides anbefales. Slides vises i rækkefølge ovenfor på forsiden.
        </p>
      </section>

      {/* ── Section C: Email templates ────────────────────────────────────── */}
      <section id="email-skabeloner">
        <h2 className="text-xl font-bold mb-1">E-mail skabeloner</h2>
        <p className="text-sm text-gray-500 mb-5">
          Rediger indhold og emnelinjer for automatiske e-mails. Brug variablerne nedenfor — de erstattes automatisk med rigtige værdier når e-mailen sendes.
        </p>
        <form onSubmit={handleSaveTemplates} className="space-y-8 max-w-2xl">

          {/* Order confirmation */}
          <div className="border rounded-xl p-5 space-y-4">
            <h3 className="font-semibold text-gray-800">Ordrebekræftelse</h3>
            <p className="text-xs text-gray-400">Sendes automatisk til kunden når betaling er gennemført.</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Emnelinje</label>
              <input
                type="text"
                value={emailTemplates["email_order_subject"] ?? ""}
                onChange={(e) => setEmailTemplates((p) => ({ ...p, email_order_subject: e.target.value }))}
                placeholder="Ordrebekræftelse – Vorbasse Boldklub"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Brødtekst (HTML)</label>
              <textarea
                rows={10}
                value={emailTemplates["email_order_body"] ?? ""}
                onChange={(e) => setEmailTemplates((p) => ({ ...p, email_order_body: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-secondary resize-y"
                placeholder="<h2>Tak for din ordre!</h2>..."
              />
              <div className="mt-1.5 flex flex-wrap gap-1.5 items-center">
                <span className="text-xs text-gray-400">Variabler:</span>
                {EMAIL_VARS["email_order_body"].map((v) => (
                  <code key={v} className="text-xs bg-gray-100 border rounded px-1.5 py-0.5 font-mono text-gray-600">{v}</code>
                ))}
              </div>
            </div>
          </div>

          {/* Shipping notification */}
          <div className="border rounded-xl p-5 space-y-4">
            <h3 className="font-semibold text-gray-800">Forsendelsesbekræftelse</h3>
            <p className="text-xs text-gray-400">Sendes til kunden når du markerer en ordre som &quot;Afsendt&quot;.</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Emnelinje</label>
              <input
                type="text"
                value={emailTemplates["email_shipping_subject"] ?? ""}
                onChange={(e) => setEmailTemplates((p) => ({ ...p, email_shipping_subject: e.target.value }))}
                placeholder="Din ordre er afsendt – Vorbasse Boldklub"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Brødtekst (HTML)</label>
              <textarea
                rows={10}
                value={emailTemplates["email_shipping_body"] ?? ""}
                onChange={(e) => setEmailTemplates((p) => ({ ...p, email_shipping_body: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-secondary resize-y"
                placeholder="<h2>Din ordre er på vej!</h2>..."
              />
              <div className="mt-1.5 flex flex-wrap gap-1.5 items-center">
                <span className="text-xs text-gray-400">Variabler:</span>
                {EMAIL_VARS["email_shipping_body"].map((v) => (
                  <code key={v} className="text-xs bg-gray-100 border rounded px-1.5 py-0.5 font-mono text-gray-600">{v}</code>
                ))}
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={savingTemplates}
              className="bg-primary text-secondary font-bold px-6 py-2 rounded-xl hover:bg-primary-dark transition text-sm disabled:opacity-50"
            >
              {savingTemplates ? "Gemmer..." : "Gem e-mail skabeloner"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
