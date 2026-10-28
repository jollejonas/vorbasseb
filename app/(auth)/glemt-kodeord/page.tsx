import { Metadata } from "next";
import { PasswordResetForm } from "@/components/auth/PasswordResetForm";

export const metadata: Metadata = { title: "Glemt kodeord", robots: { index: false, follow: false } };

export default function ForgotPasswordPage() {
  return <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold">Glemt kodeord?</h1>
        <p className="text-gray-500 mt-2">Indtast din e-mail, så sender vi et link til at vælge et nyt kodeord.</p>
      </div>
      <PasswordResetForm />
    </div>
  </div>;
}
