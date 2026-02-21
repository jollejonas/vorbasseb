import { formatPrice } from "@/lib/utils";
import type { HeroSlide, NewsPost, Product, SKU } from "@prisma/client";

export type HeroSlideWithRelations = HeroSlide & {
  overrideNews: NewsPost | null;
  overrideProduct: (Product & { skus: SKU[] }) | null;
};

export type ResolvedSlide = {
  id: string;
  heading: string;
  subheading: string | null;
  body: string | null;
  imageUrl: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  overlayOpacity: number;
};

const da = new Intl.DateTimeFormat("da-DK", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function resolveSlides(
  slides: HeroSlideWithRelations[],
  latestNews: NewsPost | null,
  latestProduct: (Product & { skus: SKU[] }) | null
): ResolvedSlide[] {
  const result: ResolvedSlide[] = [];

  for (const slide of slides) {
    if (!slide.enabled) continue;

    if (slide.type === "CUSTOM") {
      result.push({
        id: slide.id,
        heading: slide.heading ?? "Vorbasse Boldklub",
        subheading: slide.subheading ?? null,
        body: slide.body ?? null,
        imageUrl: slide.imageUrl ?? null,
        ctaLabel: slide.ctaLabel ?? null,
        ctaHref: slide.ctaHref ?? null,
        overlayOpacity: slide.overlayOpacity,
      });
      continue;
    }

    if (slide.type === "LATEST_NEWS") {
      const post = slide.overrideNews ?? latestNews;
      if (!post) continue;
      result.push({
        id: slide.id,
        heading: post.title,
        subheading: post.publishedAt ? da.format(new Date(post.publishedAt)) : null,
        body: post.content.slice(0, 200),
        imageUrl: null,
        ctaLabel: "Læs mere",
        ctaHref: `/nyheder/${post.slug}`,
        overlayOpacity: slide.overlayOpacity,
      });
      continue;
    }

    if (slide.type === "LATEST_PRODUCT") {
      const product = slide.overrideProduct ?? latestProduct;
      if (!product) continue;
      result.push({
        id: slide.id,
        heading: product.name,
        subheading: formatPrice(product.price),
        body: product.description.slice(0, 200),
        imageUrl: product.images[0] ?? null,
        ctaLabel: "Køb nu",
        ctaHref: `/butik/${product.slug}`,
        overlayOpacity: slide.overlayOpacity,
      });
      continue;
    }
  }

  return result;
}
