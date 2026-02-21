import { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Log ind" };

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">Log ind</h1>
          <p className="text-gray-500 mt-2">
            Ikke oprettet?{" "}
            <a href="/registrer" className="text-secondary underline">
              Opret konto
            </a>
          </p>
        </div>
        <LoginForm searchParams={searchParams} />
      </div>
    </div>
  );
}
