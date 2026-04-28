import { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { NewsCard } from "@/components/shop/NewsCard";

export const revalidate = 300;
export const metadata: Metadata = { title: "Nyheder" };

const PAGE_SIZE = 12;

type Props = { searchParams: Promise<{ page?: string }> };

export default async function NyhederPage({ searchParams }: Props) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1") || 1);

  const [featured, total, posts] = await Promise.all([
    // Always the absolute latest post (constant hero across pages)
    prisma.newsPost.findFirst({
      where: { publishedAt: { lte: new Date() } },
      orderBy: { publishedAt: "desc" },
    }),
    prisma.newsPost.count({ where: { publishedAt: { lte: new Date() } } }),
    prisma.newsPost.findMany({
      where: { publishedAt: { lte: new Date() } },
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE + 1, // +1 to skip the featured post
      take: PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.ceil(Math.max(0, total - 1) / PAGE_SIZE);

  const featuredDate = featured?.publishedAt
    ? new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "long", year: "numeric" }).format(
        new Date(featured.publishedAt)
      )
    : "";

  const featuredExcerpt = featured
    ? featured.content.replace(/<[^>]+>/g, "").slice(0, 220)
    : "";

  return (
    <div>
      {/* Branded page header */}
      <div className="bg-[#0a0f1e] text-white py-10 px-4">
        <div className="max-w-5xl mx-auto">
          <p className="text-primary text-xs font-bold uppercase tracking-widest mb-2">
            Vorbasse Boldklub
          </p>
          <h1 className="text-4xl md:text-5xl font-black uppercase leading-none tracking-tight">
            Nyheder
          </h1>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10">
        {total === 0 ? (
          <p className="text-gray-500 text-center py-20">Ingen nyheder endnu.</p>
        ) : (
          <>
            {/* Featured article — always shows latest, on every page */}
            {featured && (
              <Link
                href={`/nyheder/${featured.slug}`}
                className="group block rounded-2xl overflow-hidden mb-12 shadow-md hover:shadow-xl transition-shadow relative"
              >
                <div className="relative aspect-[16/7] w-full bg-gray-900">
                  {featured.coverImage && (
                    <Image
                      src={featured.coverImage}
                      alt={featured.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                      sizes="(max-width: 1024px) 100vw, 960px"
                      priority
                    />
                  )}
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                  <p className="text-primary text-xs font-bold uppercase tracking-widest mb-2">
                    {featuredDate}
                  </p>
                  <h2 className="text-white text-2xl md:text-3xl font-bold leading-tight mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                    {featured.title}
                  </h2>
                  <p className="text-white/70 text-sm line-clamp-2 mb-4 hidden sm:block">
                    {featuredExcerpt}…
                  </p>
                  <span className="inline-flex items-center gap-1.5 text-primary text-sm font-semibold">
                    Læs mere <ArrowRight size={14} />
                  </span>
                </div>
              </Link>
            )}

            {/* Grid of remaining posts */}
            {posts.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 mb-10">
                {posts.map((post) => (
                  <NewsCard key={post.id} post={post} />
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-6">
                {page > 1 ? (
                  <Link
                    href={`/nyheder?page=${page - 1}`}
                    className="px-5 py-2 rounded-xl border border-gray-300 text-sm font-medium hover:border-secondary hover:text-secondary transition"
                  >
                    ← Forrige
                  </Link>
                ) : (
                  <span className="px-5 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-300">
                    ← Forrige
                  </span>
                )}

                <span className="text-sm text-gray-500">
                  Side {page} af {totalPages}
                </span>

                {page < totalPages ? (
                  <Link
                    href={`/nyheder?page=${page + 1}`}
                    className="px-5 py-2 rounded-xl border border-gray-300 text-sm font-medium hover:border-secondary hover:text-secondary transition"
                  >
                    Næste →
                  </Link>
                ) : (
                  <span className="px-5 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-300">
                    Næste →
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
