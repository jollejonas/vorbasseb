import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import ImportNyhederClient from "./ImportNyhederClient";

export const metadata: Metadata = { title: "Importer nyheder – Admin" };

export default async function ImportNyhederPage() {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") redirect("/");

  return <ImportNyhederClient />;
}
