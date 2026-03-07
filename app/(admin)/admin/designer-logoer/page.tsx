import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DesignerLogoManager } from "@/components/admin/DesignerLogoManager";

export const metadata: Metadata = { title: "Designer-logoer – Admin" };

export default async function DesignerLogoerPage() {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") redirect("/");

  const logos = await prisma.designerLogo.findMany({ orderBy: { id: "asc" } });

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-2">Designer-logoer</h1>
      <p className="text-sm text-gray-500 mb-8">
        Logoer der kan tilføjes til jersey-design. Markér klublogoet med "Klublogo"-flaget.
      </p>
      <DesignerLogoManager initialLogos={logos} />
    </div>
  );
}
