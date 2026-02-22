import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { NewsletterClient } from "@/components/admin/NewsletterClient";

export const metadata: Metadata = { title: "Nyhedsbrev – Admin" };

export default async function AdminNyhedsbrevPage() {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") redirect("/");

  const [subscriberCount, recentSubscribers] = await Promise.all([
    prisma.user.count({ where: { newsletterConsent: true } }),
    prisma.user.findMany({
      where: { newsletterConsent: true },
      select: { name: true, email: true, newsletterConsentAt: true },
      orderBy: { newsletterConsentAt: "desc" },
      take: 10,
    }),
  ]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center gap-4 mb-8">
        <a href="/admin" className="text-sm text-gray-500 hover:text-secondary">
          ← Admin
        </a>
        <h1 className="text-3xl font-bold">Nyhedsbrev</h1>
      </div>

      {/* Stats */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-6">
        <p className="text-sm text-gray-500 mb-1">Abonnenter</p>
        <p className="text-4xl font-bold text-secondary">{subscriberCount}</p>
        <p className="text-sm text-gray-400 mt-1">registrerede brugere med tilmeldingssamtykke</p>
      </div>

      {/* Recent subscribers */}
      {recentSubscribers.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-6">
          <h2 className="text-base font-semibold mb-4">Senest tilmeldte</h2>
          <ul className="divide-y divide-gray-50 text-sm">
            {recentSubscribers.map((s) => (
              <li key={s.email} className="flex justify-between py-2">
                <span className="text-gray-800">{s.name ?? s.email}</span>
                <span className="text-gray-400 text-xs">
                  {s.newsletterConsentAt
                    ? new Intl.DateTimeFormat("da-DK").format(new Date(s.newsletterConsentAt))
                    : "–"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Compose */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6">
        <h2 className="text-base font-semibold mb-5">Skriv nyhedsbrev</h2>
        <NewsletterClient subscriberCount={subscriberCount} />
      </div>
    </div>
  );
}
