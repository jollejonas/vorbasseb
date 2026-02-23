import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PromoCodeList } from "@/components/admin/PromoCodeList";
import { Tag } from "lucide-react";

export const metadata: Metadata = { title: "Rabatkoder – Admin" };

export default async function AdminRabatkoder() {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") redirect("/");

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center gap-4 mb-8">
        <a href="/admin" className="text-sm text-gray-500 hover:text-secondary">
          ← Admin
        </a>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Tag size={28} className="text-secondary" />
          Rabatkoder
        </h1>
      </div>
      <PromoCodeList />
    </div>
  );
}
