import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AdminGenereltClient } from "@/components/admin/AdminGenereltClient";

export const metadata = { title: "Generelle indstillinger – Admin" };

export default async function GenereltPage() {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") redirect("/");

  const settings = await prisma.siteSetting.findMany();

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-8">Generelle indstillinger</h1>
      <AdminGenereltClient settings={settings} />
    </div>
  );
}
