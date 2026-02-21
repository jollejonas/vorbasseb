import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AdminNewsClient } from "@/components/admin/AdminNewsClient";

export const metadata: Metadata = { title: "Nyheder – Admin" };

export default async function AdminNyhederPage() {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") redirect("/");

  const posts = await prisma.newsPost.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <a href="/admin" className="text-sm text-gray-500 hover:text-secondary">
            ← Admin
          </a>
          <h1 className="text-3xl font-bold">Nyheder</h1>
        </div>
        <a
          href="/admin/nyheder/ny"
          className="bg-primary text-secondary font-bold px-5 py-2 rounded-xl hover:bg-primary-dark transition text-sm"
        >
          + Ny nyhed
        </a>
      </div>
      <AdminNewsClient posts={posts} />
    </div>
  );
}
