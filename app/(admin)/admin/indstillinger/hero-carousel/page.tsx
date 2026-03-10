import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AdminHeroCarouselClient } from "@/components/admin/AdminHeroCarouselClient";

export const metadata = { title: "Hero-carousel – Admin" };

export default async function HeroCarouselPage() {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") redirect("/");

  const [slides, allNews, allProducts] = await Promise.all([
    prisma.heroSlide.findMany({
      orderBy: { position: "asc" },
      include: {
        overrideNews: { select: { id: true, title: true, slug: true } },
        overrideProduct: { select: { id: true, name: true, slug: true } },
      },
    }),
    prisma.newsPost.findMany({
      where: { publishedAt: { lte: new Date() } },
      orderBy: { publishedAt: "desc" },
      select: { id: true, title: true, slug: true },
    }),
    prisma.product.findMany({
      where: { published: true },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, slug: true },
    }),
  ]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-8">Hero-carousel</h1>
      <AdminHeroCarouselClient slides={slides} allNews={allNews} allProducts={allProducts} />
    </div>
  );
}
