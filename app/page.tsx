import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ProductGrid } from "@/components/shop/ProductGrid";
import { NewsCard } from "@/components/shop/NewsCard";
import { Star, ShoppingBag, ArrowRight } from "lucide-react";

export default async function HomePage() {
  const [featuredProducts, latestNews] = await Promise.all([
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

  return (
    <>
      {/* Hero */}
      <section className="bg-secondary text-white">
        <div className="max-w-6xl mx-auto px-4 py-20 md:py-28 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 bg-primary/20 text-primary px-4 py-1.5 rounded-full text-sm font-semibold mb-6">
            <ShoppingBag size={16} /> Officiel VBK Shop
          </div>
          <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
            Vorbasse Boldklub
            <br />
            <span className="text-primary">Merchandise</span>
          </h1>
          <p className="text-lg text-white/70 max-w-xl mb-8">
            Støt dit hold med officielle trøjer og træningsudstyr. Bliv
            fanklubsmedlem og spar 10% på alle køb.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/butik"
              className="flex items-center gap-2 bg-primary text-secondary font-bold px-8 py-3 rounded-xl hover:bg-primary-dark transition"
            >
              Se butikken <ArrowRight size={18} />
            </Link>
            <Link
              href="/fanklub"
              className="flex items-center gap-2 bg-white/10 text-white font-semibold px-8 py-3 rounded-xl hover:bg-white/20 transition border border-white/20"
            >
              <Star size={18} className="text-primary" /> Bliv fanklubsmedlem
            </Link>
          </div>
        </div>
      </section>

      {/* Featured products */}
      {featuredProducts.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 py-16">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold">Udvalgte produkter</h2>
            <Link
              href="/butik"
              className="text-sm text-secondary underline hover:text-secondary-dark"
            >
              Se alle →
            </Link>
          </div>
          <ProductGrid products={featuredProducts} />
        </section>
      )}

      {/* News */}
      {latestNews.length > 0 && (
        <section className="bg-surface py-16">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold">Seneste nyheder</h2>
              <Link
                href="/nyheder"
                className="text-sm text-secondary underline hover:text-secondary-dark"
              >
                Alle nyheder →
              </Link>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {latestNews.map((post) => (
                <NewsCard key={post.id} post={post} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Fan club CTA */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="bg-secondary rounded-2xl p-10 text-white text-center">
          <Star
            size={40}
            className="text-primary mx-auto mb-4"
            fill="currentColor"
          />
          <h2 className="text-3xl font-bold mb-3">Bliv fanklubsmedlem</h2>
          <p className="text-white/70 max-w-lg mx-auto mb-6">
            Få 10% rabat på alle køb, adgang til eksklusivt merchandise og støt
            Vorbasse Boldklub direkte med dit abonnement.
          </p>
          <Link
            href="/fanklub"
            className="inline-flex items-center gap-2 bg-primary text-secondary font-bold px-8 py-3 rounded-xl hover:bg-primary-dark transition"
          >
            Se fanklubsfordele <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </>
  );
}
