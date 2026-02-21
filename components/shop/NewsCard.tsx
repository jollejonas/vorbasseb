import Link from "next/link";
import type { NewsPost } from "@prisma/client";

export function NewsCard({ post }: { post: NewsPost }) {
  const date = post.publishedAt
    ? new Intl.DateTimeFormat("da-DK", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(post.publishedAt))
    : "";

  return (
    <Link
      href={`/nyheder/${post.slug}`}
      className="block bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-shadow group"
    >
      <p className="text-xs text-gray-400 mb-2">{date}</p>
      <h3 className="font-semibold text-gray-900 group-hover:text-secondary transition-colors line-clamp-2">
        {post.title}
      </h3>
      <p className="text-sm text-gray-500 mt-2 line-clamp-3">
        {post.content.replace(/<[^>]+>/g, "").slice(0, 120)}…
      </p>
    </Link>
  );
}
