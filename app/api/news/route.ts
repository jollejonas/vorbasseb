import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { slugify } from "@/lib/utils";

export async function GET() {
  const posts = await prisma.newsPost.findMany({
    where: { publishedAt: { lte: new Date() } },
    orderBy: { publishedAt: "desc" },
  });
  return NextResponse.json(posts);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const slug = body.slug || slugify(body.title);

  const post = await prisma.newsPost.create({
    data: {
      title: body.title,
      slug,
      content: body.content,
      coverImage: body.coverImage ?? null,
      publishedAt: body.publishedAt ? new Date(body.publishedAt) : null,
    },
  });

  return NextResponse.json(post, { status: 201 });
}
