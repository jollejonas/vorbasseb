import { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = { title: "Pakketilbud – Admin" };

export default async function AdminPakketilbudPage() {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") redirect("/");

  const pakketilbud = await prisma.pakketilbud.findMany({
    include: { items: { include: { product: { select: { name: true } } }, orderBy: { position: "asc" } } },
    orderBy: [{ position: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Pakketilbud</h1>
        <Link
          href="/admin/pakketilbud/ny"
          className="bg-primary text-secondary font-bold px-5 py-2 rounded-xl hover:bg-primary-dark transition text-sm"
        >
          + Nyt pakketilbud
        </Link>
      </div>

      {pakketilbud.length === 0 ? (
        <p className="text-gray-400 text-sm">Ingen pakketilbud endnu.</p>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-gray-500">
                <th className="px-4 py-3 font-medium">Navn</th>
                <th className="px-4 py-3 font-medium">Produkter</th>
                <th className="px-4 py-3 font-medium">Pris</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pakketilbud.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {p.items.map((it) => it.product.name).join(", ") || "–"}
                  </td>
                  <td className="px-4 py-3">{formatPrice(p.price)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        p.published
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {p.published ? "Publiceret" : "Kladde"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/pakketilbud/${p.id}`}
                      className="text-sm text-primary hover:underline font-medium"
                    >
                      Rediger
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
