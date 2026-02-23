"use client";

import { useState } from "react";

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setStatus("success");
        setEmail("");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return <p className="text-sm text-primary font-semibold">Tak! Du er nu tilmeldt.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4">
      <p className="text-sm font-semibold text-white mb-2">Nyhedsbrev</p>
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Din e-mail"
          required
          className="flex-1 min-w-0 rounded-lg px-3 py-1.5 text-sm bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="shrink-0 bg-primary text-secondary text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-primary-dark transition disabled:opacity-60"
        >
          {status === "loading" ? "…" : "Tilmeld"}
        </button>
      </div>
      {status === "error" && (
        <p className="text-xs text-red-400 mt-1">Noget gik galt. Prøv igen.</p>
      )}
    </form>
  );
}
