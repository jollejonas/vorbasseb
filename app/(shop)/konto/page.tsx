import { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { AccountClient } from "@/components/shop/AccountClient";

export const metadata: Metadata = { title: "Konto" };

const PLAN_LABELS: Record<string, string> = {
  MONTHLY: "Månedlig",
  YEARLY: "Årlig",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Aktiv",
  CANCELED: "Annulleret",
  PAST_DUE: "Betaling forsinket",
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  CANCELED: "bg-gray-100 text-gray-600",
  PAST_DUE: "bg-red-100 text-red-700",
};

export default async function KontoPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      newsletterConsent: true,
      subscription: true,
    },
  });

  if (!user) redirect("/login");

  const sub = user.subscription;
  const isMember = sub?.status === "ACTIVE";

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-8">Min konto</h1>

      {/* Profile card */}
      <div className="border border-gray-100 rounded-2xl p-6 mb-6">
        <h2 className="text-base font-semibold mb-5">Profil</h2>
        <AccountClient name={user.name} email={user.email ?? ""} newsletterConsent={user.newsletterConsent} />
      </div>

      {/* Fanclub card */}
      <div className="border border-gray-100 rounded-2xl p-6 mb-6">
        <h2 className="text-base font-semibold mb-4">Fanklubsmedlemskab</h2>

        {sub ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span
                className={`text-xs font-semibold px-3 py-1 rounded-full ${
                  STATUS_COLORS[sub.status] ?? "bg-gray-100 text-gray-600"
                }`}
              >
                {STATUS_LABELS[sub.status] ?? sub.status}
              </span>
              <span className="text-sm text-gray-600">
                {PLAN_LABELS[sub.plan] ?? sub.plan} abonnement
              </span>
            </div>

            {isMember && (
              <p className="text-sm text-gray-600">
                Næste fornyelse:{" "}
                <strong>
                  {new Intl.DateTimeFormat("da-DK", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  }).format(new Date(sub.currentPeriodEnd))}
                </strong>
              </p>
            )}

            {isMember && (
              <div className="bg-primary/10 border border-primary/20 rounded-xl px-4 py-3 text-sm text-secondary font-medium">
                Du har 10% rabat på alle køb som fanklubsmedlem.
              </div>
            )}

            {sub.status === "CANCELED" && (
              <p className="text-sm text-gray-500">
                Dit medlemskab er annulleret.{" "}
                <a href="/fanklub" className="text-secondary underline">
                  Tilmeld dig igen
                </a>
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Du er ikke fanklubsmedlem endnu.
            </p>
            <a
              href="/fanklub"
              className="inline-block bg-primary text-secondary font-bold px-5 py-2 rounded-xl text-sm hover:bg-primary-dark transition"
            >
              Bliv fanklubsmedlem
            </a>
            <p className="text-xs text-gray-400">
              Fanklubsmedlemmer får 10% rabat og adgang til eksklusive produkter.
            </p>
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="border border-gray-100 rounded-2xl p-6">
        <h2 className="text-base font-semibold mb-4">Genveje</h2>
        <div className="flex flex-col gap-2">
          <a
            href="/mine-ordrer"
            className="flex items-center justify-between text-sm text-gray-700 hover:text-secondary py-1"
          >
            Mine ordrer
            <span className="text-gray-400">→</span>
          </a>
          <a
            href="/butik"
            className="flex items-center justify-between text-sm text-gray-700 hover:text-secondary py-1"
          >
            Gå til butikken
            <span className="text-gray-400">→</span>
          </a>
          <a
            href="/fanklub"
            className="flex items-center justify-between text-sm text-gray-700 hover:text-secondary py-1"
          >
            Om fanklubben
            <span className="text-gray-400">→</span>
          </a>
        </div>
      </div>
    </div>
  );
}
