import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AdminIndstillingerClient } from "@/components/admin/AdminIndstillingerClient";

export const metadata: Metadata = { title: "Indstillinger – Admin" };

export default async function AdminIndstillingerPage() {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") redirect("/");

  const [settings, slides, allNews, allProducts] = await Promise.all([
    prisma.siteSetting.findMany(),
    prisma.heroSlide.findMany({
      orderBy: { position: "asc" },
      include: {
        overrideNews: { select: { id: true, title: true, slug: true } },
        overrideProduct: { select: { id: true, name: true, slug: true } },
      },
    }),
    prisma.newsPost.findMany({
      where: { publishedAt: { lte: new Date() } },
      orderBy: { publishedAt: "desc" },
      select: { id: true, title: true, slug: true },
    }),
    prisma.product.findMany({
      where: { published: true },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, slug: true },
    }),
  ]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center gap-4 mb-8">
        <a href="/admin" className="text-sm text-gray-500 hover:text-secondary">
          ← Admin
        </a>
        <h1 className="text-3xl font-bold">Indstillinger</h1>
      </div>
      <AdminIndstillingerClient
        settings={settings}
        slides={slides}
        allNews={allNews}
        allProducts={allProducts}
      />
    </div>
  );
}
