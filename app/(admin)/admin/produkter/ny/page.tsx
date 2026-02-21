import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ProductForm } from "@/components/admin/ProductForm";

export const metadata: Metadata = { title: "Nyt produkt – Admin" };

export default async function NytProduktPage() {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") redirect("/");

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center gap-4 mb-8">
        <a
          href="/admin/produkter"
          className="text-sm text-gray-500 hover:text-secondary"
        >
          ← Produkter
        </a>
        <h1 className="text-3xl font-bold">Nyt produkt</h1>
      </div>
      <ProductForm />
    </div>
  );
}
