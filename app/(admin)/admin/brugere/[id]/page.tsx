import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";
import { UserProfileForm, MembershipButton } from "@/components/admin/UserEditForm";

const ORDER_STATUS_DA: Record<string, string> = {
  PENDING: "Afventer",
  PAID: "Betalt",
  SHIPPED: "Afsendt",
  AWAITING_PICKUP: "Klar til afhentning",
  PICKUP_READY: "Klar til afhentning",
  DELIVERED: "Leveret",
  CANCELLED: "Annulleret",
  REFUNDED: "Refunderet",
};

export const metadata: Metadata = { title: "Bruger – Admin" };

type Props = { params: Promise<{ id: string }> };

export default async function AdminBrugerDetailPage({ params }: Props) {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") redirect("/");

  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      subscription: true,
      orders: {
        orderBy: { createdAt: "desc" },
        take: 15,
      },
    },
  });

  if (!user) notFound();

  const subStatus = user.subscription?.status;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center gap-4 mb-8">
        <a
          href="/admin/brugere"
          className="text-sm text-gray-500 hover:text-secondary"
        >
          ← Brugere
        </a>
        <h1 className="text-3xl font-bold">{user.name ?? user.email}</h1>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Profile card */}
        <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-4">Profil</h2>
          <UserProfileForm
            userId={user.id}
            initialName={user.name ?? ""}
            initialEmail={user.email}
            initialRole={user.role}
          />
          <div className="mt-4 pt-4 border-t text-xs text-gray-400 space-y-1">
            <p>
              Oprettet:{" "}
              {new Intl.DateTimeFormat("da-DK").format(new Date(user.createdAt))}
            </p>
            <p>Nyhedsbrev: {user.newsletterConsent ? "Ja" : "Nej"}</p>
          </div>
        </div>

        {/* Membership card */}
        <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-4">
            Fanklubsmedlemskab
          </h2>
          {user.subscription ? (
            <div className="space-y-2 text-sm mb-4">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    subStatus === "ACTIVE"
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {subStatus === "ACTIVE"
                    ? "Aktiv"
                    : subStatus === "CANCELED"
                      ? "Opsagt"
                      : "Forfalden"}
                </span>
                <span className="text-gray-500">
                  {user.subscription.plan === "MONTHLY" ? "Månedligt" : "Årligt"}
                </span>
              </div>
              <p className="text-gray-500">
                Udløber:{" "}
                {new Intl.DateTimeFormat("da-DK").format(
                  new Date(user.subscription.currentPeriodEnd),
                )}
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-400 mb-4">
              Ingen aktivt abonnement
            </p>
          )}
          <MembershipButton
            userId={user.id}
            action={subStatus === "ACTIVE" ? "revoke" : "grant"}
          />
        </div>
      </div>

      {/* Order history */}
      <div className="mt-6 bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
        <h2 className="font-semibold text-gray-800 mb-4">Ordrehistorik</h2>
        {user.orders.length === 0 ? (
          <p className="text-sm text-gray-400">Ingen ordrer</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2 pr-4 font-medium">Dato</th>
                <th className="pb-2 pr-4 font-medium">Ordre-ID</th>
                <th className="pb-2 pr-4 font-medium">Total</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {user.orders.map((order) => (
                <tr key={order.id}>
                  <td className="py-2 pr-4 text-gray-500 whitespace-nowrap">
                    {new Intl.DateTimeFormat("da-DK").format(
                      new Date(order.createdAt),
                    )}
                  </td>
                  <td className="py-2 pr-4 font-mono text-xs text-gray-400">
                    {order.id.slice(0, 8)}…
                  </td>
                  <td className="py-2 pr-4 font-medium">
                    {formatPrice(order.total)}
                  </td>
                  <td className="py-2">
                    <span className="text-xs text-gray-600">
                      {ORDER_STATUS_DA[order.status] ?? order.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
