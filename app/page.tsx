import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { ProductCard } from "@/components/shop/ProductCard";
import { NewsCard } from "@/components/shop/NewsCard";
import { HeroCarousel } from "@/components/shop/HeroCarousel";
import { resolveSlides } from "@/lib/hero";
import { Star, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [heroSlides, latestNewsList, latestProduct, featuredProducts, newsSection] =
    await Promise.all([
      prisma.heroSlide
        .findMany({
          where: { enabled: true },
          orderBy: { position: "asc" },
          include: {
            overrideNews: true,
            overrideProduct: { include: { skus: true } },
          },
        })
        .catch(() => []),
      prisma.newsPost
        .findMany({
          where: { publishedAt: { lte: new Date() } },
          orderBy: { publishedAt: "desc" },
          take: 5,
        })
        .catch(() => []),
      prisma.product
        .findFirst({
          where: { published: true },
          include: { skus: true },
          orderBy: { createdAt: "desc" },
        })
        .catch(() => null),
      prisma.product
        .findMany({
          where: { published: true, featured: true },
          include: { skus: true },
          take: 6,
          orderBy: { createdAt: "desc" },
        })
        .catch(() => []),
      prisma.newsPost
        .findMany({
          where: { publishedAt: { lte: new Date() } },
          take: 3,
          orderBy: { publishedAt: "desc" },
        })
        .catch(() => []),
    ]);

  const resolvedSlides = resolveSlides(heroSlides, latestNewsList, latestProduct);

  return (
    <>
      <HeroCarousel slides={resolvedSlides} />

      {featuredProducts.length > 0 ? (
        <section className="bg-secondary py-16">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-white">Udvalgte produkter</h2>
              <Link href="/butik" className="text-sm text-primary hover:text-primary-dark font-semibold">
                Se alle &rarr;
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
              {featuredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      ) : (
        <section className="bg-secondary py-16">
          <div className="max-w-6xl mx-auto px-4 text-center">
            <h2 className="text-2xl font-bold text-white mb-4">Vores produkter</h2>
            <Link
              href="/butik"
              className="inline-flex items-center gap-2 bg-primary text-secondary font-black px-8 py-3 rounded-xl hover:bg-primary-dark transition text-sm"
            >
              Se butikken <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      )}

      {newsSection.length > 0 && (
        <section className="py-16">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold">Seneste nyheder</h2>
              <Link href="/nyheder" className="text-sm text-secondary underline hover:text-secondary-dark">
                Alle nyheder &rarr;
              </Link>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {newsSection.map((post) => (
                <NewsCard key={post.id} post={post} />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="bg-secondary rounded-2xl p-10 text-white text-center">
          <Image src="/logo.png" alt="Vorbasse Boldklub" width={72} height={72} className="mx-auto mb-4" />
          <h2 className="text-3xl font-bold mb-3">Bliv fanklubsmedlem</h2>
          <p className="text-white/70 max-w-lg mx-auto mb-6">
            Faa 10% rabat paa alle koeb, adgang til eksklusivt merchandise og stoet
            Vorbasse Boldklub direkte med dit abonnement.
          </p>
          <Link
            href="/fanklub"
            className="inline-flex items-center gap-2 bg-primary text-secondary font-bold px-8 py-3 rounded-xl hover:bg-primary-dark transition"
          >
            <Star size={16} /> Se fanklubsfordele <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </>
  );
}
