import { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { GrantManager } from "@/components/admin/GrantManager";

export const metadata: Metadata = { title: "Træneroversigt – Admin" };

export default async function AdminTraenerPage() {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") redirect("/");

  // All active trainer products
  const trainerProducts = await prisma.product.findMany({
    where: { published: true, clubRoleRequired: "TRAINER" },
    include: {
      skus: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // All pending grants
  const pendingGrants = await prisma.trainerGrant.findMany({
    where: { status: "PENDING" },
    include: {
      user: { select: { id: true, name: true, email: true } },
      product: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // All users with TRAINER clubRole
  const trainers = await prisma.user.findMany({
    where: { clubRole: "TRAINER" },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      orders: {
        where: {
          status: { not: "CANCELLED" },
          items: {
            some: {
              sku: {
                product: { clubRoleRequired: "TRAINER" },
              },
            },
          },
        },
        include: {
          items: {
            include: { sku: { include: { product: true } } },
            where: {
              sku: {
                product: { clubRoleRequired: "TRAINER" },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/admin" className="text-sm text-gray-500 hover:text-secondary">
          ← Admin
        </Link>
        <h1 className="text-3xl font-bold">Træneroversigt</h1>
      </div>

      {trainerProducts.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-5 py-4 mb-8 text-sm text-yellow-700">
          Ingen trænerprodukter er oprettet endnu. Opret produkter med &quot;Kræver klubrolle: Trænere&quot; i produktstyringen.
        </div>
      )}

      {trainerProducts.map((product) => {
        return (
          <section key={product.id} className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{product.name}</h2>
              <span className="text-sm text-gray-500">
                {trainers.filter((t) =>
                  t.orders.some((o) =>
                    o.items.some((i) => i.sku.productId === product.id)
                  )
                ).length} / {trainers.length} bestilt
              </span>
            </div>

            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b text-left text-gray-500">
                    <th className="px-4 py-3 font-medium">Træner</th>
                    <th className="px-4 py-3 font-medium">E-mail</th>
                    <th className="px-4 py-3 font-medium">Størrelse</th>
                    <th className="px-4 py-3 font-medium">Initialer / Tryk</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {trainers.map((trainer) => {
                    // Find the most recent order item for this product
                    const matchingItem = trainer.orders
                      .flatMap((o) => o.items.map((i) => ({ ...i, orderStatus: o.status })))
                      .find((i) => i.sku.productId === product.id);

                    return (
                      <tr key={trainer.id}>
                        <td className="px-4 py-3 font-medium">
                          {trainer.name ?? "–"}
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {trainer.email}
                        </td>
                        <td className="px-4 py-3">
                          {matchingItem ? (
                            <span className="font-mono font-semibold bg-green-50 text-green-700 px-2 py-0.5 rounded">
                              {matchingItem.sku.size}
                            </span>
                          ) : (
                            <span className="text-gray-300">–</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {matchingItem
                            ? [matchingItem.customName, matchingItem.customNumber ? `#${matchingItem.customNumber}` : null]
                                .filter(Boolean)
                                .join(" ") || "–"
                            : <span className="text-gray-300">–</span>}
                        </td>
                        <td className="px-4 py-3">
                          {matchingItem ? (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                              ✓ Bestilt
                            </span>
                          ) : (
                            <span className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded-full font-medium">
                              Ikke bestilt
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      {trainers.length === 0 && (
        <p className="text-gray-400 italic text-sm">
          Ingen brugere har trænertilladelse endnu. Sæt en brugers klubrolle til TRAINER under brugerstyring.
        </p>
      )}

      <GrantManager
        trainers={trainers.map((t) => ({ id: t.id, name: t.name, email: t.email }))}
        products={trainerProducts.map((p) => ({ id: p.id, name: p.name }))}
        initialGrants={pendingGrants.map((g) => ({
          id: g.id,
          userId: g.userId,
          productId: g.productId,
          user: { name: g.user.name, email: g.user.email },
          product: { name: g.product.name },
          createdAt: g.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
