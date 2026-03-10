import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AdminEmailSkabelonerClient } from "@/components/admin/AdminEmailSkabelonerClient";

export const metadata = { title: "E-mail skabeloner – Admin" };

export default async function EmailSkabelonerPage() {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") redirect("/");

  const settings = await prisma.siteSetting.findMany();

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-2">E-mail skabeloner</h1>
      <p className="text-sm text-gray-500 mb-8">
        Rediger indhold og emnelinjer for automatiske e-mails. Brug variablerne nedenfor — de erstattes automatisk med rigtige værdier når e-mailen sendes.
      </p>
      <AdminEmailSkabelonerClient settings={settings} />
    </div>
  );
}
