"use client";

import { toast } from "sonner";
import type { NewsPost } from "@prisma/client";

export function AdminNewsClient({ posts }: { posts: NewsPost[] }) {
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

  return (
    <ul className="divide-y divide-gray-100">
      {posts.map((post) => (
        <li key={post.id} className="flex items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
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
  );
}
