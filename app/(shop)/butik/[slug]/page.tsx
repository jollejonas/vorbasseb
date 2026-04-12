import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getVatRate } from "@/lib/vat";
import { ProductColorSection } from "@/components/shop/ProductColorSection";
import { ProductOptionsSection } from "@/components/shop/ProductOptionsSection";
import { SimpleAddToCart } from "@/components/shop/SimpleAddToCart";
import { JerseyDesignerSection } from "@/components/shop/JerseyDesignerSection";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await prisma.product.findUnique({ where: { slug } });
  return { title: p?.name ?? "Produkt" };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;

  const [product, vatPct, designerLogos] = await Promise.all([
    prisma.product.findUnique({
      where: { slug, published: true },
      include: {
        skus: {
          where: { colorVariantId: null },
          orderBy: { size: "asc" },
          include: { optionValues: { select: { optionValueId: true } } },
        },
        category: { include: { parent: true } },
        colorVariants: {
          include: { skus: { orderBy: { size: "asc" } } },
          orderBy: { position: "asc" },
        },
        optionGroups: {
          include: {
            values: {
              include: { globalColor: true, skuValues: true },
              orderBy: { position: "asc" },
            },
          },
          orderBy: { position: "asc" },
        },
        designerZones: { include: { fixedLogo: true }, orderBy: { positionOrd: "asc" } },
      },
    }),
    getVatRate(),
    prisma.designerLogo.findMany({ orderBy: { id: "asc" } }),
  ]);

  if (!product) notFound();

  // Enforce membersOnly gate server-side
  if (product.membersOnly) {
    const session = await auth();
    let isMember = false;
    if (session?.user?.id) {
      const sub = await prisma.subscription.findUnique({ where: { userId: session.user.id } });
      isMember = sub?.status === "ACTIVE";
    }
    if (!isMember) redirect("/fanklub");
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-6">
        <a href="/butik" className="hover:text-secondary">
          Butik
        </a>
        {product.category?.parent && (
          <>
            {" / "}
            <a
              href={`/butik?kategori=${product.category.parent.slug}`}
              className="hover:text-secondary"
            >
              {product.category.parent.name}
            </a>
          </>
        )}
        {product.category && (
          <>
            {" / "}
            <a
              href={`/butik?kategori=${product.category.slug}`}
              className="hover:text-secondary"
            >
              {product.category.name}
            </a>
          </>
        )}
        {" / "}
        <span className="text-gray-900">{product.name}</span>
      </nav>

      {/* Group order banner */}
      {product.isGroupOrder && (
        <div className="mb-6 flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <span className="text-blue-600 text-lg mt-0.5">📦</span>
          <div>
            <p className="text-sm font-semibold text-blue-900">Samlebestilling</p>
            <p className="text-sm text-blue-700 mt-0.5">
              Dette produkt indgår i en samlebestilling. Din betaling gennemføres straks, men ordren behandles og sendes først efter deadline.
            </p>
            {product.groupOrderDeadline && (
              <p className="text-sm font-medium text-blue-800 mt-1">
                Deadline:{" "}
                {new Date(product.groupOrderDeadline).toLocaleString("da-DK", {
                  timeZone: "Europe/Copenhagen",
                  dateStyle: "long",
                  timeStyle: "short",
                })}
              </p>
            )}
          </div>
        </div>
      )}

      {product.designerEnabled ? (
        <JerseyDesignerSection
          product={product}
          zones={product.designerZones}
          logos={designerLogos}
          skus={product.skus}
          vatPct={vatPct}
          optionGroups={product.optionGroups}
        />
      ) : product.optionGroups.length > 0 ? (
        <ProductOptionsSection
          product={product}
          skus={product.skus}
          optionGroups={product.optionGroups}
          vatPct={vatPct}
        />
      ) : product.colorVariants.length > 0 ? (
        <ProductColorSection
          product={product}
          skus={product.skus}
          colorVariants={product.colorVariants}
          vatPct={vatPct}
        />
      ) : (
        <SimpleAddToCart product={product} skus={product.skus} vatPct={vatPct} />
      )}
    </div>
  );
}
