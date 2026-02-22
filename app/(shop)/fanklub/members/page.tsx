import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";
import { Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { CopyButton } from "@/components/shop/CopyButton";

export const metadata: Metadata = { title: "Fanklub – Medlemsside" };

export default async function FanklubMembersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, subscription: true },
  });

  if (!user?.subscription || user.subscription.status !== "ACTIVE") {
    redirect("/fanklub");
  }

  const sub = user.subscription;

  const [exclusiveProducts, exclusiveNews, memberPromoCode] = await Promise.all([
    prisma.product.findMany({
      where: { membersEarlyAccess: true, published: true },
      include: { skus: true },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.newsPost.findMany({
      where: { membersOnly: true, publishedAt: { not: null } },
      orderBy: { publishedAt: "desc" },
      take: 5,
    }),
    prisma.siteSetting.findUnique({ where: { key: "member_promo_code" } }),
  ]);

  const promoCode = memberPromoCode?.value;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      {/* Welcome */}
      <div className="bg-secondary text-white rounded-2xl p-8">
        <div className="flex items-center gap-3 mb-4">
          <Star size={28} className="text-primary" fill="currentColor" />
          <h1 className="text-2xl font-bold">
            Velkommen, {user.name?.split(" ")[0] ?? "fanklubsmedlem"}!
          </h1>
        </div>
        <p className="text-white/80 text-sm mb-5">
          Du er et aktivt fanklubsmedlem. Her er dine fordele.
        </p>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="bg-white/10 rounded-xl p-4">
            <p className="text-white/60 text-xs mb-1">Abonnementstype</p>
            <p className="font-semibold">
              {sub.plan === "YEARLY" ? "Årligt" : "Månedligt"}
            </p>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <p className="text-white/60 text-xs mb-1">Næste fornyelse</p>
            <p className="font-semibold">
              {new Intl.DateTimeFormat("da-DK", {
                day: "numeric",
                month: "long",
                year: "numeric",
              }).format(new Date(sub.currentPeriodEnd))}
            </p>
          </div>
        </div>
      </div>

      {/* Discount */}
      <div className="border border-gray-100 rounded-2xl p-6">
        <h2 className="text-base font-semibold mb-3">Din 10% rabat</h2>
        <p className="text-sm text-gray-600 mb-4">
          Din 10% fanklubsrabat påføres automatisk, når du er logget ind og går til betaling.
        </p>
        {promoCode && (
          <div className="flex items-center gap-3">
            <code className="bg-gray-100 px-4 py-2 rounded-lg font-mono text-secondary font-bold tracking-widest text-lg">
              {promoCode}
            </code>
            <CopyButton text={promoCode} />
          </div>
        )}
      </div>

      {/* Early access products */}
      {exclusiveProducts.length > 0 && (
        <div className="border border-gray-100 rounded-2xl p-6">
          <h2 className="text-base font-semibold mb-4">
            Tidlig adgang — kun for fanklubsmedlemmer
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {exclusiveProducts.map((p) => (
              <Link
                key={p.id}
                href={`/butik/${p.slug}`}
                className="group block rounded-xl overflow-hidden border border-gray-100 hover:border-secondary transition"
              >
                <div className="relative aspect-square bg-gray-50">
                  {p.images[0] ? (
                    <Image
                      src={p.images[0]}
                      alt={p.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 font-bold">VBK</div>
                  )}
                  <span className="absolute top-2 left-2 bg-primary text-secondary text-xs font-bold px-2 py-0.5 rounded-full">
                    Tidlig adgang
                  </span>
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-secondary font-bold">{formatPrice(p.price)}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Members-only news */}
      {exclusiveNews.length > 0 && (
        <div className="border border-gray-100 rounded-2xl p-6">
          <h2 className="text-base font-semibold mb-4">Eksklusivt for fanklubsmedlemmer</h2>
          <ul className="divide-y divide-gray-50">
            {exclusiveNews.map((post) => (
              <li key={post.id}>
                <Link
                  href={`/nyheder/${post.slug}`}
                  className="flex items-center justify-between py-3 text-sm hover:text-secondary transition"
                >
                  <span className="font-medium">{post.title}</span>
                  <span className="text-gray-400 text-xs shrink-0 ml-4">
                    {post.publishedAt
                      ? new Intl.DateTimeFormat("da-DK").format(new Date(post.publishedAt))
                      : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

