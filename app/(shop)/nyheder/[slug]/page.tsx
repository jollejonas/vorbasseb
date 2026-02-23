import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { ShareButtons } from "@/components/shop/ShareButtons";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await prisma.newsPost.findUnique({ where: { slug } });
  return { title: post?.title ?? "Nyhed" };
}

export default async function NyhedsartikelPage({ params }: Props) {
  const { slug } = await params;
  const post = await prisma.newsPost.findUnique({
    where: { slug, publishedAt: { lte: new Date() } },
  });

  if (!post) notFound();

  const date = post.publishedAt
    ? new Intl.DateTimeFormat("da-DK", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(post.publishedAt))
    : "";

  return (
    <article className="max-w-4xl mx-auto px-4 py-10">
      <nav className="text-sm text-gray-500 mb-6">
        <a href="/nyheder" className="hover:text-secondary">
          Nyheder
        </a>{" "}
        / <span className="text-gray-900">{post.title}</span>
      </nav>

      <p className="text-sm text-gray-400 mb-2">{date}</p>
      <h1 className="text-3xl font-bold mb-6">{post.title}</h1>

      {post.coverImage && (
        <div className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden mb-8">
          <Image
            src={post.coverImage}
            alt={post.title}
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 896px"
            priority
          />
        </div>
      )}

      <div
        className="news-content"
        dangerouslySetInnerHTML={{ __html: post.content }}
      />

      <ShareButtons slug={post.slug} title={post.title} />

      <div className="mt-6">
        <Link
          href="/nyheder"
          className="inline-flex items-center gap-2 text-sm text-secondary font-semibold hover:text-secondary-dark transition"
        >
          ← Alle nyheder
        </Link>
      </div>
    </article>
  );
}
