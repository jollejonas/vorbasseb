"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { slugify } from "@/lib/utils";
import type { NewsPost } from "@prisma/client";

export function NewsForm({ post }: { post?: NewsPost }) {
  const router = useRouter();
  const isEdit = !!post;

  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [slugManual, setSlugManual] = useState(isEdit);
  const [content, setContent] = useState(post?.content ?? "");
  const [published, setPublished] = useState(!!post?.publishedAt);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!slugManual) setSlug(slugify(title));
  }, [title, slugManual]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title,
        slug,
        content,
        publishedAt: published ? new Date().toISOString() : null,
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
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
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
          URL: /nyheder/{slug || "..."}
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Indhold <span className="text-red-500">*</span>
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          rows={12}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary resize-y font-mono"
          placeholder="Skriv nyheden her... Markdown understøttes."
        />
        <p className="text-xs text-gray-400 mt-1">
          Markdown understøttes: **fed**, *kursiv*, ## overskrift, - liste
        </p>
      </div>

      <div>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
            className="w-4 h-4 accent-secondary"
          />
          <span className="text-sm font-medium">Udgiv nu</span>
        </label>
        <p className="text-xs text-gray-400 mt-1 ml-6">
          {published
            ? "Nyheden vil være synlig på siden med det samme."
            : "Nyheden gemmes som kladde og er ikke synlig."}
        </p>
      </div>

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
