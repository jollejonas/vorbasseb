import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getVatRate } from "@/lib/vat";
import { formatPrice, withVat } from "@/lib/utils";
import { PakketilbudWizard } from "@/components/shop/PakketilbudWizard";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await prisma.pakketilbud.findUnique({ where: { slug } });
  return { title: p?.name ?? "Pakketilbud" };
}

export default async function PakketilbudPage({ params }: Props) {
  const { slug } = await params;

  const [pakketilbud, vatPct] = await Promise.all([
    prisma.pakketilbud.findUnique({
      where: { slug, published: true },
      include: {
        items: {
          include: {
            product: {
              include: {
                optionGroups: {
                  include: {
                    values: {
                      include: { globalColor: true, skuValues: true },
                      orderBy: { position: "asc" },
                    },
                  },
                  orderBy: { position: "asc" },
                },
                skus: {
                  where: { colorVariantId: null },
                  include: { optionValues: { select: { optionValueId: true } } },
                },
                colorVariants: {
                  include: { skus: { orderBy: { size: "asc" } } },
                  orderBy: { position: "asc" },
                },
              },
            },
          },
          orderBy: { position: "asc" },
        },
      },
    }),
    getVatRate(),
  ]);

  if (!pakketilbud) notFound();

  // A pakketilbud is sold out if any item has zero total stock across all SKUs
  const soldOutItems = pakketilbud.items
    .map((item) => {
      const allSkus = [
        ...item.product.skus,
        ...item.product.colorVariants.flatMap((cv) => cv.skus),
      ];
      const outOfStock = allSkus.length > 0 && allSkus.every((s) => s.stock === 0);
      return outOfStock ? (item.label ?? item.product.name) : null;
    })
    .filter(Boolean) as string[];

  const isSoldOut = soldOutItems.length > 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-6">
        <Link href="/butik" className="hover:text-secondary">Butik</Link>
        {" / "}
        <span className="text-gray-900">{pakketilbud.name}</span>
      </nav>

      {/* Hero */}
      <div className="grid md:grid-cols-2 gap-8 mb-12">
        <div>
          {pakketilbud.images.length > 0 ? (
            <div className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pakketilbud.images[0]}
                alt={pakketilbud.name}
                className="w-full aspect-square object-cover rounded-2xl"
              />
              {pakketilbud.images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {pakketilbud.images.slice(1).map((url, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={i}
                      src={url}
                      alt=""
                      className="w-20 h-20 object-cover rounded-lg shrink-0"
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="w-full aspect-square bg-gray-100 rounded-2xl flex items-center justify-center text-gray-300">
              Intet billede
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <span className="inline-block bg-secondary/10 text-secondary text-xs font-semibold px-3 py-1 rounded-full mb-3 uppercase tracking-wide">
              Pakketilbud
            </span>
            <h1 className="text-3xl font-black mb-2">{pakketilbud.name}</h1>
            <p className="text-2xl font-bold text-secondary">
              {formatPrice(withVat(pakketilbud.price, vatPct))}
              <span className="text-sm text-gray-400 font-normal ml-1">inkl. moms</span>
            </p>
          </div>
          {pakketilbud.description && (
            <p className="text-gray-600 leading-relaxed">{pakketilbud.description}</p>
          )}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Indeholder:</p>
            <ul className="space-y-1">
              {pakketilbud.items.map((item) => (
                <li key={item.id} className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="w-1.5 h-1.5 bg-secondary rounded-full shrink-0" />
                  {item.label ?? item.product.name}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Sold-out banner */}
      {isSoldOut && (
        <div className="mb-6 rounded-xl border border-orange-200 bg-orange-50 px-5 py-4 text-sm text-orange-800">
          <strong>Midlertidigt udsolgt:</strong>{" "}
          {soldOutItems.join(", ")}{" "}
          {soldOutItems.length === 1 ? "er" : "er"} i øjeblikket udsolgt og pakken kan derfor ikke bestilles.
        </div>
      )}

      {/* Wizard */}
      <div className="border-t pt-10">
        <h2 className="text-xl font-bold mb-6">Sammensæt din pakke</h2>
        <PakketilbudWizard pakketilbud={pakketilbud} vatPct={vatPct} isSoldOut={isSoldOut} />
      </div>
    </div>
  );
}
