import { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { TrainerAdminClient } from "@/components/admin/TrainerAdminClient";

export const metadata: Metadata = { title: "Træneroversigt – Admin" };

export default async function AdminTraenerPage() {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") redirect("/");

  const [trainerProducts, rawTrainers, pendingGrants] = await Promise.all([
    prisma.product.findMany({
      where: { published: true, clubRoleRequired: "TRAINER" },
      select: { id: true, name: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
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
              some: { sku: { product: { clubRoleRequired: "TRAINER" } } },
            },
          },
          include: {
            items: {
              where: { sku: { product: { clubRoleRequired: "TRAINER" } } },
              include: {
                sku: {
                  include: { product: { select: { id: true, name: true } } },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.trainerGrant.findMany({
      where: { status: "PENDING" },
      include: {
        user: { select: { id: true, name: true, email: true } },
        product: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Serialize for client component
  const trainers = rawTrainers.map((t) => ({
    id: t.id,
    name: t.name,
    email: t.email,
    orderedItems: t.orders.flatMap((o) =>
      o.items.map((i) => ({
        productId: i.sku.productId,
        productName: i.sku.product.name,
        size: i.sku.size,
      }))
    ),
    lastOrderDate: t.orders[0]?.createdAt?.toISOString() ?? null,
  }));

  const grants = pendingGrants.map((g) => ({
    id: g.id,
    userId: g.userId,
    productId: g.productId,
    user: { id: g.user.id, name: g.user.name, email: g.user.email },
    product: { id: g.product.id, name: g.product.name },
    createdAt: g.createdAt.toISOString(),
  }));

  // Products eligible for bulk grant = those with no current pending grants
  const grantedProductIds = new Set(pendingGrants.map((g) => g.productId));
  const bulkEligibleProducts = trainerProducts.filter((p) => !grantedProductIds.has(p.id));

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

      {trainers.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 mb-8 text-sm text-gray-500">
          Ingen brugere har trænertilladelse endnu. Sæt en brugers klubrolle til TRAINER under brugerstyring.
        </div>
      )}

      <TrainerAdminClient
        trainers={trainers}
        trainerProducts={trainerProducts}
        initialGrants={grants}
        initialBulkEligibleProducts={bulkEligibleProducts}
      />
    </div>
  );
}
