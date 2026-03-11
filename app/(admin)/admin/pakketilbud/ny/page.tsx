import { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PakketilbudForm } from "@/components/admin/PakketilbudForm";

export const metadata: Metadata = { title: "Nyt pakketilbud – Admin" };

export default async function AdminNytPakketilbudPage() {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") redirect("/");

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/admin/pakketilbud" className="text-sm text-gray-500 hover:text-secondary">
          ← Pakketilbud
        </Link>
        <h1 className="text-2xl font-bold">Nyt pakketilbud</h1>
      </div>
      <PakketilbudForm />
    </div>
  );
}
