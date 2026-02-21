import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { ProductCard } from "@/components/shop/ProductCard";
import { NewsCard } from "@/components/shop/NewsCard";
import { Star, ArrowRight } from "lucide-react";

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

  const heroImageUrl = process.env.NEXT_PUBLIC_HERO_IMAGE_URL;

  return (
    <>
      {/* Hero */}
      <section className="relative bg-secondary text-white overflow-hidden">
        {heroImageUrl && (
          <Image
            src={heroImageUrl}
            alt="Vorbasse Boldklub"
            fill
            className="object-cover object-center opacity-40"
            priority
            sizes="100vw"
          />
        )}
        <div className="relative max-w-6xl mx-auto px-4 py-24 md:py-36">
          <div className="absolute top-6 right-4 md:right-0">
            <Link
              href="/butik"
              className="bg-primary text-secondary font-black text-xs tracking-widest px-4 py-3 block text-center leading-tight hover:bg-primary-dark transition"
            >
              SE MERE<br />HER
            </Link>
          </div>
          <div className="flex flex-col items-start gap-2 max-w-xl">
            <h1 className="text-5xl md:text-7xl font-black uppercase leading-none tracking-tight">
              Vorbasse<br />Boldklub
            </h1>
            <p className="text-2xl md:text-3xl font-light italic text-primary">Klubdragt</p>
            <p className="text-white/70 text-base mt-2 max-w-sm">
              Stoet dit hold med officielle trojer og traeningsudstyr. Bliv fanklubsmedlem og spar 10% paa alle koeb.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              <Link href="/butik" className="flex items-center gap-2 bg-primary text-secondary font-black px-8 py-3 rounded-xl hover:bg-primary-dark transition text-sm tracking-wide">
                Se butikken <ArrowRight size={16} />
              </Link>
              <Link href="/fanklub" className="flex items-center gap-2 bg-white/10 text-white font-semibold px-8 py-3 rounded-xl hover:bg-white/20 transition border border-white/20 text-sm">
                <Star size={16} className="text-primary" /> Bliv fanklubsmedlem
              </Link>
            </div>
          </div>
        </div>
      </section>

      {featuredProducts.length > 0 ? (
        <section className="bg-secondary py-16">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-white">Udvalgte produkter</h2>
              <Link href="/butik" className="text-sm text-primary hover:text-primary-dark font-semibold">Se alle &#8594;</Link>
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
            <Link href="/butik" className="inline-flex items-center gap-2 bg-primary text-secondary font-black px-8 py-3 rounded-xl hover:bg-primary-dark transition text-sm">
              Se butikken <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      )}

      {latestNews.length > 0 && (
        <section className="py-16">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold">Seneste nyheder</h2>
              <Link href="/nyheder" className="text-sm text-secondary underline hover:text-secondary-dark">Alle nyheder &#8594;</Link>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {latestNews.map((post) => (
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
            Faa 10% rabat paa alle koeb, adgang til eksklusivt merchandise og stoet Vorbasse Boldklub direkte med dit abonnement.
          </p>
          <Link href="/fanklub" className="inline-flex items-center gap-2 bg-primary text-secondary font-bold px-8 py-3 rounded-xl hover:bg-primary-dark transition">
            Se fanklubsfordele <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </>
  );
}
