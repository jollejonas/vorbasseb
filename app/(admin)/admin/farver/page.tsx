import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { GlobalColorManager } from "@/components/admin/GlobalColorManager";

export const metadata: Metadata = { title: "Farvebibliotek – Admin" };

export default async function FarverPage() {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") redirect("/");

  const colors = await prisma.globalColor.findMany({
    orderBy: { position: "asc" },
  });

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-2">Farvebibliotek</h1>
      <p className="text-sm text-gray-500 mb-8">
        Globale farver bruges på tværs af alle produkter. Koden (2 cifre) indgår i varenummeret.
      </p>
      <GlobalColorManager initialColors={colors} />
    </div>
  );
}
