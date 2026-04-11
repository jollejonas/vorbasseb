"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { toast } from "sonner";

type Props = {
  token: string;
  email: string;
};

export function AdminSetupForm({ token, email }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const name = fd.get("name") as string;
    const password = fd.get("password") as string;

    const res = await fetch("/api/admin/users/invite/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, name, password }),
    });

    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error ?? "Noget gik galt");
      setLoading(false);
      return;
    }

    await signIn("credentials", { email, password, redirect: false });
    toast.success("Admin-konto oprettet!");
    router.push("/admin");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-gray-100 rounded-2xl shadow-sm p-8 space-y-5"
    >
      <div>
        <label className="block text-sm font-medium mb-1">E-mail</label>
        <input
          type="email"
          value={email}
          readOnly
          className="w-full border rounded-xl px-4 py-3 text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Navn</label>
        <input
          name="name"
          type="text"
          required
          minLength={2}
          autoComplete="name"
          className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Adgangskode{" "}
          <span className="text-gray-400 font-normal">(min. 8 tegn)</span>
        </label>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-secondary text-white font-bold py-3 rounded-xl hover:bg-secondary-dark transition disabled:opacity-60"
      >
        {loading ? "Opretter konto…" : "Opret konto"}
      </button>
    </form>
  );
}
