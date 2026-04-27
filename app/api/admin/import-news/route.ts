import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export const runtime = "nodejs";

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ── GET: list external articles for a given year ──────────────────────────
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    // @ts-expect-error custom field
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const yearParam = req.nextUrl.searchParams.get("year");
    const year = /^\d{4}$/.test(yearParam ?? "")
      ? yearParam!
      : new Date().getFullYear().toString();

    const [{ fetchNewsListing }, { prisma }] = await Promise.all([
      import("@/lib/news-import"),
      import("@/lib/prisma"),
    ]);

    const articles = await fetchNewsListing(year);

    const existingSlugs = new Set(
      (await prisma.newsPost.findMany({ select: { slug: true } })).map((p) => p.slug),
    );

    return NextResponse.json({
      articles: articles.map((a) => ({ ...a, exists: existingSlugs.has(a.slug) })),
    });
  } catch (err) {
    return NextResponse.json({ error: toErrorMessage(err) }, { status: 500 });
  }
}

// ── POST: import a single article ─────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    // @ts-expect-error custom field
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const articleUrl = body.articleUrl;
    if (!articleUrl) return NextResponse.json({ error: "Missing articleUrl" }, { status: 400 });

    const { importArticle } = await import("@/lib/news-import");
    const result = await importArticle(articleUrl);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    return NextResponse.json({ error: toErrorMessage(err) }, { status: 500 });
  }
}

