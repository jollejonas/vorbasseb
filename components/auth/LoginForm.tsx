"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function LoginForm({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const email = fd.get("email") as string;
    const password = fd.get("password") as string;

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      toast.error("Forkert e-mail eller adgangskode");
    } else {
      toast.success("Du er logget ind");
      // Get callback from searchParams if possible
      router.push("/");
      router.refresh();
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-gray-100 rounded-2xl shadow-sm p-8 space-y-5"
    >
      <div>
        <label className="block text-sm font-medium mb-1">E-mail</label>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Adgangskode</label>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-secondary text-white font-bold py-3 rounded-xl hover:bg-secondary-dark transition disabled:opacity-60"
      >
        {loading ? "Logger ind…" : "Log ind"}
      </button>
    </form>
  );
}
