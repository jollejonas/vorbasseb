import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SponsorManager } from "@/components/admin/SponsorManager";

export const metadata: Metadata = { title: "Sponsorer – Admin" };

export default async function SponsorerPage() {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") redirect("/");

  const [sponsors, headingSetting] = await Promise.all([
    prisma.sponsor.findMany({ orderBy: { position: "asc" } }),
    prisma.siteSetting.findUnique({ where: { key: "sponsors_heading" } }),
  ]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-2">Sponsorer</h1>
      <p className="text-sm text-gray-500 mb-8">
        Administrer sponsorer, der vises i footeren på webshoppen.
      </p>
      <SponsorManager
        initialSponsors={sponsors}
        initialHeading={headingSetting?.value ?? "Støt vores sponsorer"}
      />
    </div>
  );
}
