import Link from "next/link";
import type { NewsPost } from "@prisma/client";

export function NewsCard({ post, horizontal = false }: { post: NewsPost; horizontal?: boolean }) {
  const date = post.publishedAt
    ? new Intl.DateTimeFormat("da-DK", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(post.publishedAt))
    : "";

  const excerpt = post.content.replace(/<[^>]+>/g, "").slice(0, 140);

  if (horizontal) {
    return (
      <Link
        href={`/nyheder/${post.slug}`}
        className="flex gap-0 bg-gray-50 rounded-xl overflow-hidden hover:shadow-md transition-shadow group border border-gray-200"
      >
        {post.coverImage && (
          <div className="w-48 sm:w-64 shrink-0 overflow-hidden">
            <img
              src={post.coverImage}
              alt={post.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        )}
        <div className="p-5 flex flex-col justify-center">
          <p className="text-xs text-gray-400 mb-1">{date}</p>
          <h3 className="font-semibold text-gray-900 group-hover:text-secondary transition-colors line-clamp-2 mb-2">
            {post.title}
          </h3>
          <p className="text-sm text-gray-600 line-clamp-3">{excerpt}…</p>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/nyheder/${post.slug}`}
      className="flex flex-col bg-gray-50 rounded-xl overflow-hidden hover:shadow-md transition-shadow group border border-gray-200"
    >
      {post.coverImage && (
        <div className="aspect-[16/8] w-full overflow-hidden">
          <img
            src={post.coverImage}
            alt={post.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      )}
      <div className="p-5">
        <p className="text-xs text-gray-400 mb-1">{date}</p>
        <h3 className="font-semibold text-gray-900 group-hover:text-secondary transition-colors line-clamp-2 mb-2">
          {post.title}
        </h3>
        <p className="text-sm text-gray-600 line-clamp-3">{excerpt}…</p>
      </div>
    </Link>
  );
}
