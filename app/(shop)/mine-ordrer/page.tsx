import { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { OrderList } from "@/components/shop/OrderList";

export const metadata: Metadata = { title: "Mine ordrer" };

export default async function MineOrdrerPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [orders, cfg] = await Promise.all([
    prisma.order.findMany({
      where: { userId: session.user.id },
      include: {
        items: {
          include: { sku: { include: { product: { select: { name: true } } } } },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.siteSetting.findMany({ where: { key: "vat_rate" } }).catch(() => []),
  ]);

  const vatPct = parseInt(cfg.find((s) => s.key === "vat_rate")?.value ?? "25");

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-8">Mine ordrer</h1>

      {orders.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-500 mb-4">Du har endnu ingen ordrer.</p>
          <a href="/butik" className="text-secondary underline hover:text-secondary-dark">
            Gå til butikken
          </a>
        </div>
      ) : (
        <OrderList orders={orders} vatPct={vatPct} />
      )}
    </div>
  );
}
