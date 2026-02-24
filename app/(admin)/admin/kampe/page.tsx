import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Trophy } from "lucide-react";
import { AdminKampeClient } from "@/components/admin/AdminKampeClient";

export const metadata: Metadata = { title: "Kampe – Admin" };

export default async function AdminKampePage() {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") redirect("/");

  const [configs, teams] = await Promise.all([
    prisma.dbuTeamConfig.findMany({
      include: {
        matches: { orderBy: { matchDateTime: "asc" } },
        standings: { orderBy: { sort: "asc" } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.footballTeam.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center gap-4 mb-8">
        <a href="/admin" className="text-sm text-gray-500 hover:text-secondary">
          ← Admin
        </a>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Trophy size={28} className="text-secondary" />
          Kampe
        </h1>
      </div>
      <AdminKampeClient configs={configs} teams={teams} />
    </div>
  );
}
