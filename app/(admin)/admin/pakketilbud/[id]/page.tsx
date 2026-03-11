import { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PakketilbudForm } from "@/components/admin/PakketilbudForm";

export const metadata: Metadata = { title: "Rediger pakketilbud – Admin" };

type Params = { params: Promise<{ id: string }> };

export default async function AdminEditPakketilbudPage({ params }: Params) {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") redirect("/");

  const { id } = await params;

  const pakketilbud = await prisma.pakketilbud.findUnique({
    where: { id },
    include: {
      items: {
        include: { product: { select: { id: true, name: true, images: true } } },
        orderBy: { position: "asc" },
      },
    },
  });

  if (!pakketilbud) notFound();

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/admin/pakketilbud" className="text-sm text-gray-500 hover:text-secondary">
          ← Pakketilbud
        </Link>
        <h1 className="text-2xl font-bold">Rediger: {pakketilbud.name}</h1>
      </div>
      <PakketilbudForm pakketilbud={pakketilbud} />
    </div>
  );
}
