"use client";

import Link from "next/link";
import { useState } from "react";

export function PasswordResetForm({ token }: { token?: string }) {
  const resetting = token !== undefined;
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const inputClass = "w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-secondary";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password") ?? "");
    if (resetting && password !== data.get("confirmPassword")) {
      setError("De to kodeord skal være ens.");
      return;
    }
    if (resetting && new TextEncoder().encode(password).length > 72) {
      setError("Kodeordet er for langt. Brug et kortere kodeord (maks. 72 bytes).");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/auth/${resetting ? "reset-password" : "forgot-password"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(resetting ? { token, password } : { email: data.get("email") }),
      });
      const result = await response.json();
      if (!response.ok) setError(result.error || "Noget gik galt. Prøv igen.");
      else setMessage(result.message);
    } catch {
      setError("Der kunne ikke oprettes forbindelse. Prøv igen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-8 space-y-5">
      {message ? <p role="status">{message}</p> : (
        <form onSubmit={submit} className="space-y-5">
          {resetting ? <>
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1">Nyt kodeord</label>
              <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className={inputClass} aria-describedby="password-help" />
              <p id="password-help" className="text-sm text-gray-500 mt-1">Brug mindst 8 tegn.</p>
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1">Gentag nyt kodeord</label>
              <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required className={inputClass} />
            </div>
          </> : <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">E-mail</label>
            <input id="email" name="email" type="email" autoComplete="email" maxLength={254} required className={inputClass} />
          </div>}
          {error && <p role="alert" className="text-red-700 text-sm">{error}</p>}
          <button type="submit" disabled={loading} className="w-full bg-secondary text-white font-bold py-3 rounded-xl hover:bg-secondary-dark transition disabled:opacity-60">
            {loading ? "Vent venligst…" : resetting ? "Gem nyt kodeord" : "Send link"}
          </button>
        </form>
      )}
      {resetting && !message && <Link href="/glemt-kodeord" className="block text-secondary underline text-sm">Bed om et nyt link</Link>}
      <Link href="/login" className="block text-secondary underline text-sm">Tilbage til login</Link>
    </div>
  );
}
