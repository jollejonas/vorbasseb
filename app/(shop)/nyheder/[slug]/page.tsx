import { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

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
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.coverImage}
          alt={post.title}
          className="w-full rounded-2xl mb-8"
        />
      )}

      <div
        className="news-content"
        dangerouslySetInnerHTML={{ __html: post.content }}
      />
    </article>
  );
}
