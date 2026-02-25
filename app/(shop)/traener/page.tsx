import { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ProductCard } from "@/components/shop/ProductCard";

export const metadata: Metadata = { title: "Trænere" };

export default async function TraenerPage() {
  const session = await auth();

  // @ts-expect-error custom field
  const clubRole = session?.user?.clubRole ?? "NONE";

  if (!session?.user) {
    redirect("/login?callbackUrl=/traener");
  }

  if (clubRole !== "TRAINER") {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
        <h1 className="text-3xl font-black uppercase mb-3">Ingen adgang</h1>
        <p className="text-gray-500 mb-6">
          Denne side er kun tilgængelig for trænere.
        </p>
        <Link
          href="/butik"
          className="bg-primary text-secondary font-bold px-6 py-2 rounded-xl hover:bg-primary-dark transition text-sm"
        >
          Gå til butik
        </Link>
      </div>
    );
  }

  const products = await prisma.product.findMany({
    where: { published: true, clubRoleRequired: "TRAINER" },
    include: { skus: { select: { stock: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="bg-[#0a0f1e] text-white py-10 px-4">
        <div className="max-w-7xl mx-auto">
          <p className="text-primary text-xs font-bold uppercase tracking-widest mb-2">
            Vorbasse Boldklub
          </p>
          <h1 className="text-4xl md:text-5xl font-black uppercase leading-none tracking-tight">
            Trænere
          </h1>
          <p className="text-white/70 text-sm mt-2">
            Produkter til trænerstaben — tilføj til kurven og bestil via kassen
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-10">
        {products.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg">
              Ingen trænerprodukter tilgængelige i øjeblikket.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {products.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
