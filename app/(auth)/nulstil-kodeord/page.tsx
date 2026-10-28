import { Metadata } from "next";
import Link from "next/link";
import { PasswordResetForm } from "@/components/auth/PasswordResetForm";

export const metadata: Metadata = { title: "Vælg nyt kodeord", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function ResetPasswordPage({ searchParams }: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;
  const valid = typeof token === "string" && /^[a-f0-9]{64}$/.test(token);
  return <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
    <div className="w-full max-w-md">
      <h1 className="text-3xl font-bold text-center mb-8">Vælg nyt kodeord</h1>
      {valid ? <PasswordResetForm token={token} /> : <div className="text-center space-y-4">
        <p>Linket er ugyldigt. Bed om et nyt link for at nulstille dit kodeord.</p>
        <Link href="/glemt-kodeord" className="text-secondary underline">Bed om et nyt link</Link>
      </div>}
    </div>
  </div>;
}
