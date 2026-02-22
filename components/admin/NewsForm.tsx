"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { slugify } from "@/lib/utils";
import { TipTapEditor } from "@/components/admin/TipTapEditor";
import type { NewsPost } from "@prisma/client";

export function NewsForm({ post }: { post?: NewsPost }) {
  const router = useRouter();
  const isEdit = !!post;

  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [slugManual, setSlugManual] = useState(isEdit);
  const [slugChanged, setSlugChanged] = useState(false);
  const [content, setContent] = useState(post?.content ?? "");
  const [coverImage, setCoverImage] = useState(post?.coverImage ?? "");
  const [membersOnly, setMembersOnly] = useState(post?.membersOnly ?? false);
  const [published, setPublished] = useState(!!post?.publishedAt);
  const [saving, setSaving] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const widgetRef = useRef<any>(null);

  useEffect(() => {
    if (!slugManual) setSlug(slugify(title));
  }, [title, slugManual]);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://upload-widget.cloudinary.com/global/all.js";
    script.async = true;
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

  function openCoverImageWidget() {
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
          multiple: false,
          resourceType: "image",
          folder: "vbk-nyheder",
          clientAllowedFormats: ["jpg", "jpeg", "png", "webp"],
          maxFileSize: 5000000,
        },
        (error: unknown, result: { event: string; info: { secure_url: string } }) => {
          if (error) { toast.error("Upload fejlede"); return; }
          if (result.event === "success") setCoverImage(result.info.secure_url);
        }
      );
    }
    widgetRef.current?.open();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title,
        slug,
        content,
        coverImage: coverImage || null,
        membersOnly,
        publishedAt: published ? (post?.publishedAt ?? new Date().toISOString()) : null,
      };

      const url = isEdit ? `/api/news/${post.id}` : "/api/news";
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

      toast.success(isEdit ? "Nyhed opdateret" : "Nyhed oprettet");
      router.push("/admin/nyheder");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Noget gik galt");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Titel <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
          placeholder="f.eks. Kampresultat mod FC Kolding"
        />
      </div>

      {/* Slug */}
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
            if (isEdit && post?.publishedAt) setSlugChanged(true);
          }}
          required
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary font-mono"
        />
        <p className="text-xs text-gray-400 mt-1">URL: /nyheder/{slug || "..."}</p>
        {slugChanged && isEdit && post?.publishedAt && (
          <p className="text-xs text-amber-600 mt-1 font-medium">
            ⚠️ Advarsel: Ændring af slug på en udgivet nyhed bryder eksisterende URL&apos;er og links.
          </p>
        )}
      </div>

      {/* Cover image */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Forsidebillede</label>
        {coverImage ? (
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coverImage} alt="Cover" className="h-40 rounded-lg object-cover border" />
            <button
              type="button"
              onClick={() => setCoverImage("")}
              className="absolute top-1 right-1 bg-white/90 rounded-full w-6 h-6 text-sm text-red-600 hover:bg-white font-bold leading-none"
            >
              ×
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={openCoverImageWidget}
            className="flex items-center gap-2 border-2 border-dashed border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-500 hover:border-secondary hover:text-secondary transition"
          >
            <span className="text-lg leading-none">+</span> Upload forsidebillede
          </button>
        )}
      </div>

      {/* Content (TipTap) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Indhold <span className="text-red-500">*</span>
        </label>
        <TipTapEditor
          content={content}
          onChange={setContent}
          placeholder="Skriv nyheden her..."
        />
      </div>

      {/* Flags */}
      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
            className="w-4 h-4 accent-secondary"
          />
          <span className="text-sm font-medium">Udgiv nu</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={membersOnly}
            onChange={(e) => setMembersOnly(e.target.checked)}
            className="w-4 h-4 accent-secondary"
          />
          <span className="text-sm font-medium">Kun for fanklubsmedlemmer</span>
        </label>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2 border-t">
        <button
          type="submit"
          disabled={saving}
          className="bg-primary text-secondary font-bold px-6 py-2 rounded-xl hover:bg-primary-dark transition text-sm disabled:opacity-50"
        >
          {saving ? "Gemmer..." : isEdit ? "Gem ændringer" : "Opret nyhed"}
        </button>
        <a
          href="/admin/nyheder"
          className="px-6 py-2 rounded-xl border text-sm text-gray-600 hover:border-gray-400 transition"
        >
          Annuller
        </a>
      </div>
    </form>
  );
}
