import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Users } from "lucide-react";

export const metadata: Metadata = { title: "Brugere – Admin" };

type Props = {
  searchParams: Promise<{ q?: string }>;
};

export default async function AdminBrugerePage({ searchParams }: Props) {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") redirect("/");

  const { q } = await searchParams;

  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    include: {
      subscription: true,
      _count: { select: { orders: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center gap-4 mb-8">
        <a href="/admin" className="text-sm text-gray-500 hover:text-secondary">
          ← Admin
        </a>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Users size={28} className="text-secondary" />
          Brugere
        </h1>
      </div>

      {/* Search */}
      <form method="GET" className="flex gap-2 mb-6 max-w-md">
        <input
          name="q"
          defaultValue={q}
          placeholder="Søg på navn eller e-mail..."
          className="border rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-secondary"
        />
        <button
          type="submit"
          className="bg-secondary text-white px-4 py-2 rounded-lg text-sm hover:bg-secondary-dark transition"
        >
          Søg
        </button>
        {q && (
          <a
            href="/admin/brugere"
            className="px-4 py-2 rounded-lg text-sm border border-gray-200 hover:bg-gray-50 transition"
          >
            Ryd
          </a>
        )}
      </form>

      <p className="text-sm text-gray-500 mb-4">
        {users.length} {users.length === 1 ? "bruger" : "brugere"}
        {q && ` for "${q}"`}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="pb-3 pr-4 font-medium">Navn</th>
              <th className="pb-3 pr-4 font-medium">E-mail</th>
              <th className="pb-3 pr-4 font-medium">Rolle</th>
              <th className="pb-3 pr-4 font-medium">Fanklub</th>
              <th className="pb-3 pr-4 font-medium">Ordrer</th>
              <th className="pb-3 pr-4 font-medium">Oprettet</th>
              <th className="pb-3 font-medium">Handling</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((user) => {
              const subStatus = user.subscription?.status;
              return (
                <tr key={user.id}>
                  <td className="py-3 pr-4 font-medium">
                    {user.name ?? "–"}
                  </td>
                  <td className="py-3 pr-4 text-gray-600">{user.email}</td>
                  <td className="py-3 pr-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        user.role === "ADMIN"
                          ? "bg-primary/20 text-secondary"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {user.role === "ADMIN" ? "Admin" : "Kunde"}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        subStatus === "ACTIVE"
                          ? "bg-green-100 text-green-700"
                          : subStatus
                            ? "bg-gray-100 text-gray-500"
                            : "text-gray-400"
                      }`}
                    >
                      {subStatus === "ACTIVE"
                        ? "Aktiv"
                        : subStatus === "CANCELED"
                          ? "Opsagt"
                          : subStatus === "PAST_DUE"
                            ? "Forfalden"
                            : "–"}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-gray-600">
                    {user._count.orders}
                  </td>
                  <td className="py-3 pr-4 text-gray-500 whitespace-nowrap">
                    {new Intl.DateTimeFormat("da-DK").format(
                      new Date(user.createdAt),
                    )}
                  </td>
                  <td className="py-3">
                    <Link
                      href={`/admin/brugere/${user.id}`}
                      className="text-secondary hover:underline text-xs font-medium"
                    >
                      Se profil
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
