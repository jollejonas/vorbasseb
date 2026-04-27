import { NextRequest, NextResponse } from "next/server";
import { fetchNewsListing, importArticle } from "@/lib/news-import";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured on the server" },
      { status: 500 },
    );
  }

  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentYear = new Date().getFullYear();
  const years = [currentYear.toString(), (currentYear - 1).toString()];

  try {
    const listingTotals: Record<string, number> = {};
    const listingErrors: string[] = [];
    const articlesBySlug = new Map<string, { url: string; slug: string; year: string }>();

    for (const year of years) {
      try {
        const articles = await fetchNewsListing(year);
        listingTotals[year] = articles.length;

        for (const article of articles) {
          if (articlesBySlug.has(article.slug)) continue;
          articlesBySlug.set(article.slug, { url: article.url, slug: article.slug, year });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        listingErrors.push(`${year}: ${message}`);

        if (year === years[0]) {
          throw err;
        }
      }
    }

    const articles = Array.from(articlesBySlug.values());

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const article of articles) {
      try {
        const result = await importArticle(article.url);
        if (result.skipped) {
          skipped++;
        } else {
          imported++;
        }
      } catch (err) {
        errors.push(
          `${article.year}/${article.slug}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return NextResponse.json({
      ok: true,
      years,
      listingTotals,
      total: articles.length,
      imported,
      skipped,
      listingErrors: listingErrors.length > 0 ? listingErrors : undefined,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
