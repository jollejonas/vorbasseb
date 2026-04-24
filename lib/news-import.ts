import { prisma } from "@/lib/prisma";
import * as cheerio from "cheerio";
import { sanitizeHtml } from "@/lib/sanitizeHtml";

export const NEWS_BASE_URL = "https://live-911-vorbasse-b-af-1912.umbraco-proxy.com";
const LISTING_FETCH_TIMEOUT_MS = 10_000;
const ARTICLE_FETCH_TIMEOUT_MS = 15_000;
const NEWS_FETCH_HEADERS = {
  "user-agent": "VBKNewsSync/1.0 (+https://vbkshoppen.dk)",
};

const DANISH_MONTHS: Record<string, number> = {
  januar: 0, februar: 1, marts: 2, april: 3, maj: 4, juni: 5,
  juli: 6, august: 7, september: 8, oktober: 9, november: 10, december: 11,
};

export function parseDanishDate(text: string): Date | null {
  const m = text.match(/(\d{1,2})\.\s+(\w+)\s+(\d{4})\s+kl[.:]?\s*(\d{1,2}):(\d{2})/i);
  if (!m) return null;
  const monthNum = DANISH_MONTHS[m[2].toLowerCase()];
  if (monthNum === undefined) return null;
  return new Date(parseInt(m[3]), monthNum, parseInt(m[1]), parseInt(m[4]), parseInt(m[5]));
}

export function urlToSlug(url: string): string {
  return url.split("/").filter(Boolean).pop() ?? "";
}

export async function fetchNewsListing(
  year: string,
): Promise<{ title: string; url: string; date: string; slug: string }[]> {
  const listingBase = `${NEWS_BASE_URL}/nyheder/klub-nyheder/nyheder-${year}/`;
  const seen = new Set<string>();
  const articles: { title: string; url: string; date: string; slug: string }[] = [];

  for (let page = 0; page < 20; page++) {
    const pageUrl = page === 0 ? listingBase : `${listingBase}?no=${page}`;
    let html: string;
    try {
      const res = await fetch(pageUrl, {
        cache: "no-store",
        headers: NEWS_FETCH_HEADERS,
        signal: AbortSignal.timeout(LISTING_FETCH_TIMEOUT_MS),
      });
      if (!res.ok) {
        if (page === 0) {
          throw new Error(`Unable to fetch news listing (${res.status})`);
        }
        break;
      }
      html = await res.text();
    } catch {
      if (page === 0) {
        throw new Error("Unable to reach news listing");
      }
      break;
    }

    const $ = cheerio.load(html);
    let found = 0;

    $(`a[href*="/nyheder/klub-nyheder/nyheder-${year}/"]`).each((_, el) => {
      const href = $(el).attr("href") ?? "";
      const slug = urlToSlug(href);

      if (!slug || /^nyheder-\d{4}$/.test(slug)) return;

      const text = $(el).text().trim().replace(/\s+/g, " ");

      if (seen.has(slug)) {
        if (text) {
          const existing = articles.find((a) => a.slug === slug);
          if (existing) existing.title = text;
        }
        return;
      }
      seen.add(slug);

      const card = $(el).closest('[class*="newsListItem"], article, .news-item, li').first();
      const cardText = (card.length ? card : $(el).parent()).text();
      const rawDate = cardText.match(/(\d{2})-(\d{2})-(\d{4})/);
      const date = rawDate
        ? `${rawDate[1]}.${rawDate[2]}.${rawDate[3]}`
        : (cardText.match(/\d{1,2}\.\s+\w+\s+\d{4}/) ?? [""])[0];

      const url = href.startsWith("http") ? href : NEWS_BASE_URL + href;
      articles.push({ title: text || slug, url, date, slug });
      found++;
    });

    if (found === 0) break;
  }

  return articles;
}

export interface ImportArticleResult {
  id: string;
  skipped?: boolean;
}

export async function importArticle(articleUrl: string): Promise<ImportArticleResult> {
  const slug = urlToSlug(articleUrl);

  const existing = await prisma.newsPost.findUnique({ where: { slug } });
  if (existing && existing.title !== slug && existing.title.includes(" ")) {
    return { id: existing.id, skipped: true };
  }

  const res = await fetch(articleUrl, {
    cache: "no-store",
    headers: NEWS_FETCH_HEADERS,
    signal: AbortSignal.timeout(ARTICLE_FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();

  const $ = cheerio.load(html);

  const coverImageRaw =
    $(".theme_newsItem_imageWrap img[data-src]").first().attr("data-src") ??
    $(".theme_newsItem_imageHolder img[data-src]").first().attr("data-src") ??
    null;
  const coverImage = coverImageRaw
    ? (coverImageRaw.startsWith("http") ? coverImageRaw : NEWS_BASE_URL + coverImageRaw)
        .replace(/[?&]rnd=[^&]*/g, "")
        .replace(/\?$/, "")
    : null;

  const title =
    $(".theme_newsItem_headerWrap h1").first().text().trim() ||
    $("h1").first().text().trim() ||
    $("h2").first().text().trim() ||
    slug;

  $("nav, header, footer, script, style, noscript, [class*='nav'], [class*='menu'], [class*='footer'], [class*='header'], [class*='breadcrumb'], [class*='social'], [class*='share']").remove();

  let publishedAt: Date | null = null;
  $("p, span, div").each((_, el) => {
    const text = $(el).text().trim();
    if (/\d{1,2}\.\s+\w+\s+\d{4}\s+kl/i.test(text) && !publishedAt) {
      publishedAt = parseDanishDate(text);
    }
  });

  const articleRoot = $(".theme_newsItem").clone();
  articleRoot.find(".theme_newsItem_headerWrap, .theme_newsItem_imageWrap").remove();

  const bodyParts: string[] = [];
  articleRoot.find("p, h2, h3, h4, h5, ul, ol, blockquote").each((_, el) => {
    const text = $(el).text().trim();
    if (!text) return;
    if ($(el).find("a").length > 4) return;
    const tagName = (el as { tagName?: string }).tagName?.toLowerCase() ?? "";
    if (tagName === "p" && text.length < 4) return;
    bodyParts.push($.html(el) ?? "");
  });

  const content = sanitizeHtml(bodyParts.join("\n"));

  const payload = {
    title,
    slug,
    content,
    coverImage,
    publishedAt: publishedAt ?? existing?.publishedAt ?? new Date(),
    membersOnly: false,
  };

  const post = existing
    ? await prisma.newsPost.update({ where: { slug }, data: payload })
    : await prisma.newsPost.create({ data: payload });

  return { id: post.id };
}
