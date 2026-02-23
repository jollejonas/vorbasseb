import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { NewsCard } from "@/components/shop/NewsCard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Nyheder" };

export default async function NyhederPage() {
  const posts = await prisma.newsPost.findMany({
    where: { publishedAt: { lte: new Date() } },
    orderBy: { publishedAt: "desc" },
  });

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-8">Nyheder</h1>

      {posts.length === 0 ? (
        <p className="text-gray-500 text-center py-20">
          Ingen nyheder endnu.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {posts.map((post) => (
            <NewsCard key={post.id} post={post} horizontal />
          ))}
        </div>
      )}
    </div>
  );
}
