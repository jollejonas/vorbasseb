import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { OptionTemplateManager } from "@/components/admin/OptionTemplateManager";

export const metadata = { title: "Tilvalg – Admin" };

export default async function TilvalgPage() {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") redirect("/");

  const [templates, globalColors] = await Promise.all([
    prisma.optionGroupTemplate.findMany({
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      include: {
        values: {
          include: { globalColor: true },
          orderBy: { position: "asc" },
        },
      },
    }),
    prisma.globalColor.findMany({ orderBy: { position: "asc" } }),
  ]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-8">Tilvalg – skabelonbibliotek</h1>
      <OptionTemplateManager initialTemplates={templates} globalColors={globalColors} />
    </div>
  );
}
