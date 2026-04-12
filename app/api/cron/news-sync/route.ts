import { NextRequest, NextResponse } from "next/server";
import { fetchNewsListing, importArticle } from "@/lib/news-import";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const year = new Date().getFullYear().toString();

  try {
    const articles = await fetchNewsListing(year);

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
        errors.push(`${article.slug}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return NextResponse.json({
      ok: true,
      year,
      total: articles.length,
      imported,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
