import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";
import Link from "next/link";
import { Package, ShoppingBag, Users, Newspaper, Settings, Mail } from "lucide-react";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") redirect("/");

  const [orderCount, activeMembers, revenue, productCount] = await Promise.all([
    prisma.order.count({ where: { status: { in: ["PAID", "SHIPPED"] } } }),
    prisma.subscription.count({ where: { status: "ACTIVE" } }),
    prisma.order.aggregate({
      where: { status: { in: ["PAID", "SHIPPED", "DELIVERED"] } },
      _sum: { total: true },
    }),
    prisma.product.count({ where: { published: true } }),
  ]);

  const stats = [
    {
      label: "Aktive ordrer",
      value: orderCount,
      icon: ShoppingBag,
      href: "/admin/ordrer",
    },
    {
      label: "Fanklubsmedlemmer",
      value: activeMembers,
      icon: Users,
      href: null,
    },
    {
      label: "Samlet omsætning",
      value: formatPrice(revenue._sum.total ?? 0),
      icon: ShoppingBag,
      href: "/admin/ordrer",
    },
    {
      label: "Aktive produkter",
      value: productCount,
      icon: Package,
      href: "/admin/produkter",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-8">Admin-panel</h1>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm"
          >
            <s.icon size={20} className="text-secondary mb-3" />
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-sm text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div className="grid md:grid-cols-5 gap-4">
        {[
          { href: "/admin/produkter", label: "Produkter", icon: Package },
          { href: "/admin/ordrer", label: "Ordrer", icon: ShoppingBag },
          { href: "/admin/nyheder", label: "Nyheder", icon: Newspaper },
          { href: "/admin/nyhedsbrev", label: "Nyhedsbrev", icon: Mail },
          { href: "/admin/indstillinger", label: "Indstillinger", icon: Settings },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="flex items-center gap-3 bg-secondary text-white rounded-xl p-5 hover:bg-secondary-dark transition"
          >
            <l.icon size={24} className="text-primary" />
            <span className="font-semibold">{l.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
