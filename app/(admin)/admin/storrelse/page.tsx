import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SizePresetManager } from "@/components/admin/SizePresetManager";

export const metadata: Metadata = { title: "Størrelser – Admin" };

export default async function StorrelsePage() {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") redirect("/");

  const sizes = await prisma.sizePreset.findMany({ orderBy: { position: "asc" } });

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-2">Størrelser</h1>
      <p className="text-sm text-gray-500 mb-8">
        Administrer de tilgængelige størrelser til produkter. Rækkefølgen her afspejles på
        produktsiden og i butikkens størrelsesfilter.
      </p>
      <SizePresetManager initialSizes={sizes} />
    </div>
  );
}
