"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import type { NewsPost } from "@prisma/client";

export function AdminNewsClient({ posts }: { posts: NewsPost[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === posts.length ? new Set() : new Set(posts.map((p) => p.id)),
    );
  }

  async function deletePost(id: string, title: string) {
    if (!confirm(`Slet "${title}"?`)) return;
    const res = await fetch(`/api/news/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Nyhed slettet");
      window.location.reload();
    } else {
      toast.error("Noget gik galt");
    }
  }

  async function deleteSelected() {
    if (!confirm(`Slet ${selected.size} nyheder?`)) return;
    const ids = Array.from(selected);
    await Promise.all(ids.map((id) => fetch(`/api/news/${id}`, { method: "DELETE" })));
    toast.success(`${ids.length} nyheder slettet`);
    window.location.reload();
  }

  async function togglePublish(post: NewsPost) {
    const publishedAt = post.publishedAt ? null : new Date().toISOString();
    const res = await fetch(`/api/news/${post.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...post, publishedAt }),
    });
    if (res.ok) {
      toast.success(post.publishedAt ? "Nyhed skjult" : "Nyhed udgivet");
      window.location.reload();
    } else {
      toast.error("Noget gik galt");
    }
  }

  const allSelected = posts.length > 0 && selected.size === posts.length;

  return (
    <div>
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-red-50 border border-red-100 rounded-xl">
          <span className="text-sm text-red-700 font-medium">{selected.size} valgt</span>
          <button
            onClick={deleteSelected}
            className="flex items-center gap-1.5 bg-red-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-red-700 transition"
          >
            <Trash2 size={13} />
            Slet valgte
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs text-red-500 hover:text-red-700 underline"
          >
            Fravælg alle
          </button>
        </div>
      )}

      <ul className="divide-y divide-gray-100">
        <li className="flex items-center gap-4 py-2">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="w-4 h-4 accent-secondary"
          />
          <span className="text-xs text-gray-400">{posts.length} nyheder</span>
        </li>
        {posts.map((post) => (
          <li key={post.id} className="flex items-center justify-between gap-4 py-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <input
                type="checkbox"
                checked={selected.has(post.id)}
                onChange={() => toggleSelect(post.id)}
                className="w-4 h-4 accent-secondary shrink-0"
              />
              {post.coverImage ? (
                <img
                  src={post.coverImage}
                  alt=""
                  className="w-12 h-12 rounded-lg object-cover shrink-0 bg-gray-100"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-gray-100 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="font-medium truncate">{post.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {post.publishedAt
                    ? `Udgivet ${new Intl.DateTimeFormat("da-DK").format(new Date(post.publishedAt))}`
                    : "Kladde"}
                </p>
              </div>
            </div>
            <div className="flex gap-3 text-xs shrink-0">
              <a
                href={`/admin/nyheder/${post.id}`}
                className="text-secondary underline hover:text-secondary-dark"
              >
                Rediger
              </a>
              <button
                onClick={() => togglePublish(post)}
                className="text-gray-500 underline hover:text-gray-800"
              >
                {post.publishedAt ? "Skjul" : "Udgiv"}
              </button>
              <button
                onClick={() => deletePost(post.id, post.title)}
                className="text-red-400 underline hover:text-red-600"
              >
                Slet
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
