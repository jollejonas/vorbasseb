import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { NewsForm } from "@/components/admin/NewsForm";

export const metadata: Metadata = { title: "Rediger nyhed – Admin" };

type Props = { params: Promise<{ id: string }> };

export default async function RedigerNyhedPage({ params }: Props) {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") redirect("/");

  const { id } = await params;
  const post = await prisma.newsPost.findUnique({ where: { id } });

  if (!post) notFound();

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center gap-4 mb-8">
        <a
          href="/admin/nyheder"
          className="text-sm text-gray-500 hover:text-secondary"
        >
          ← Nyheder
        </a>
        <h1 className="text-3xl font-bold">Rediger nyhed</h1>
      </div>
      <NewsForm post={post} />
    </div>
  );
}
