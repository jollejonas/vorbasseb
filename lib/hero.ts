import { formatPrice } from "@/lib/utils";
import type { HeroSlide, NewsPost, Product, SKU } from "@prisma/client";

export type HeroSlideWithRelations = HeroSlide & {
  overrideNews: NewsPost | null;
  overrideProduct: (Product & { skus: SKU[] }) | null;
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

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
  latestNewsList: NewsPost[],
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
      const count = Math.min(Math.max((slide.newsCount ?? 1), 1), 5);
      const posts =
        count === 1 && slide.overrideNews
          ? [slide.overrideNews]
          : latestNewsList.slice(0, count);
      for (const post of posts) {
        result.push({
          id: `${slide.id}-${post.id}`,
          heading: post.title,
          subheading: post.publishedAt ? da.format(new Date(post.publishedAt)) : null,
          body: stripHtml(post.content).slice(0, 200),
          imageUrl: post.coverImage ?? null,
          ctaLabel: "Læs mere",
          ctaHref: `/nyheder/${post.slug}`,
          overlayOpacity: slide.overlayOpacity,
        });
      }
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
