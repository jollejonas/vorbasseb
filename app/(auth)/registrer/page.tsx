import { Metadata } from "next";
import { RegisterForm } from "@/components/auth/RegisterForm";

export const metadata: Metadata = { title: "Opret konto" };

export default function RegisterPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">Opret konto</h1>
          <p className="text-gray-500 mt-2">
            Har du allerede en konto?{" "}
            <a href="/login" className="text-secondary underline">
              Log ind
            </a>
          </p>
        </div>
        <RegisterForm />
      </div>
    </div>
  );
}
