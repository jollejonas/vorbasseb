import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { fetchNewsListing, importArticle } from "@/lib/news-import";

// ── GET: list external articles for a given year ──────────────────────────
export async function GET(req: NextRequest) {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const year = req.nextUrl.searchParams.get("year") ?? new Date().getFullYear().toString();
  const articles = await fetchNewsListing(year);

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

  try {
    const result = await importArticle(articleUrl);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

