import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { NewsForm } from "@/components/admin/NewsForm";

export const metadata: Metadata = { title: "Ny nyhed – Admin" };

export default async function NyNyhedPage() {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") redirect("/");

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center gap-4 mb-8">
        <a
          href="/admin/nyheder"
          className="text-sm text-gray-500 hover:text-secondary"
        >
          ← Nyheder
        </a>
        <h1 className="text-3xl font-bold">Ny nyhed</h1>
      </div>
      <NewsForm />
    </div>
  );
}
