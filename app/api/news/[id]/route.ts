import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  const post = await prisma.newsPost.update({
    where: { id },
    data: {
      title: body.title,
      slug: body.slug,
      content: body.content,
      coverImage: body.coverImage ?? null,
      membersOnly: body.membersOnly ?? false,
      publishedAt: body.publishedAt ? new Date(body.publishedAt) : null,
    },
  });

  return NextResponse.json(post);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await prisma.newsPost.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
