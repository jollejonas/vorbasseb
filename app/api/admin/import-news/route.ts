import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import * as cheerio from "cheerio";

const BASE_URL = "https://live-911-vorbasse-b-af-1912.umbraco-proxy.com";

const DANISH_MONTHS: Record<string, number> = {
  januar: 0, februar: 1, marts: 2, april: 3, maj: 4, juni: 5,
  juli: 6, august: 7, september: 8, oktober: 9, november: 10, december: 11,
};

function parseDanishDate(text: string): Date | null {
  // "21. februar 2026 kl. 18:00" or "5. februar 2026 kl. 17:00"
  const m = text.match(/(\d{1,2})\.\s+(\w+)\s+(\d{4})\s+kl[.:]?\s*(\d{1,2}):(\d{2})/i);
  if (!m) return null;
  const monthNum = DANISH_MONTHS[m[2].toLowerCase()];
  if (monthNum === undefined) return null;
  return new Date(parseInt(m[3]), monthNum, parseInt(m[1]), parseInt(m[4]), parseInt(m[5]));
}

function urlToSlug(url: string): string {
  return url.split("/").filter(Boolean).pop() ?? "";
}

// ── GET: list external articles for a given year ──────────────────────────
export async function GET(req: NextRequest) {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const year = req.nextUrl.searchParams.get("year") ?? new Date().getFullYear().toString();
  const listingBase = `${BASE_URL}/nyheder/klub-nyheder/nyheder-${year}/`;

  const seen = new Set<string>();
  const articles: { title: string; url: string; date: string; slug: string }[] = [];

  // Paginate through the listing (5 articles/page, ?no=0,1,2,...)
  for (let page = 0; page < 20; page++) {
    const pageUrl = page === 0 ? listingBase : `${listingBase}?no=${page}`;
    let html: string;
    try {
      const res = await fetch(pageUrl, { cache: "no-store" });
      if (!res.ok) break;
      html = await res.text();
    } catch {
      break;
    }

    const $ = cheerio.load(html);
    let found = 0;

    // Find all links that match the article URL pattern for this year
    $(`a[href*="/nyheder/klub-nyheder/nyheder-${year}/"]`).each((_, el) => {
      const href = $(el).attr("href") ?? "";
      const slug = urlToSlug(href);
      if (!slug || seen.has(slug)) return;
      seen.add(slug);

      // Try to get title from the link text or its children
      const title = $(el).text().trim().replace(/\s+/g, " ") || slug;

      // Try to get date from surrounding text
      const card = $(el).closest('[class*="newsListItem"], article, .news-item, li').first();
      const cardText = (card.length ? card : $(el).parent()).text();
      const dateMatch = cardText.match(/\d{1,2}\.\s+\w+\s+\d{4}/);
      const date = dateMatch ? dateMatch[0] : "";

      articles.push({ title, url: BASE_URL + href, date, slug });
      found++;
    });

    if (found === 0) break; // no more pages
  }

  // Check which slugs already exist in our DB
  const existingSlugs = new Set(
    (await prisma.newsPost.findMany({ select: { slug: true } })).map((p) => p.slug),
  );

  return NextResponse.json({
    articles: articles.map((a) => ({ ...a, exists: existingSlugs.has(a.slug) })),
  });
}

// ── POST: import a single article ─────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { articleUrl } = await req.json();
  if (!articleUrl) return NextResponse.json({ error: "Missing articleUrl" }, { status: 400 });

  const slug = urlToSlug(articleUrl);

  // Idempotency: skip if already imported
  const existing = await prisma.newsPost.findUnique({ where: { slug } });
  if (existing) return NextResponse.json({ ok: true, id: existing.id, skipped: true });

  let html: string;
  try {
    const res = await fetch(articleUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const $ = cheerio.load(html);

  // Remove navigation, header, footer, scripts, styles
  $("nav, header, footer, script, style, noscript, [class*='nav'], [class*='menu'], [class*='footer'], [class*='header'], [class*='breadcrumb'], [class*='social'], [class*='share']").remove();

  // Extract title: first h1 or h2
  const title = $("h1").first().text().trim() || $("h2").first().text().trim() || slug;

  // Extract date: find a paragraph matching the Danish date pattern
  let publishedAt: Date | null = null;
  let dateParagraphText = "";
  $("p, span, div").each((_, el) => {
    const text = $(el).text().trim();
    if (/\d{1,2}\.\s+\w+\s+\d{4}\s+kl/i.test(text) && !dateParagraphText) {
      dateParagraphText = text;
      publishedAt = parseDanishDate(text);
    }
  });

  // Extract body: all meaningful content elements, skip anything before the date
  let pastMeta = false;
  const bodyParts: string[] = [];

  $("p, h2, h3, h4, h5, ul, ol, blockquote").each((_, el) => {
    const text = $(el).text().trim();
    if (!text) return;

    // Once we've passed the date/author area, start collecting
    if (!pastMeta) {
      if (dateParagraphText && text.includes(dateParagraphText.slice(0, 15))) {
        pastMeta = true;
        return; // skip the date paragraph itself
      }
      // If no date found yet, skip short lines (author, category) and start after 50 chars
      if (!dateParagraphText && text.length > 50) {
        pastMeta = true;
      } else {
        return;
      }
    }

    // Skip lines that look like navigation or share buttons (many short links)
    if ($(el).find("a").length > 4) return;
    // Skip very short orphaned lines that are probably UI artifacts
    const tagName = (el as { tagName?: string }).tagName?.toLowerCase() ?? "";
    if (tagName === "p" && text.length < 4) return;

    bodyParts.push($.html(el) ?? "");
  });

  const content = bodyParts.join("\n");

  const post = await prisma.newsPost.create({
    data: {
      title,
      slug,
      content,
      publishedAt: publishedAt ?? new Date(),
      membersOnly: false,
    },
  });

  return NextResponse.json({ ok: true, id: post.id });
}
