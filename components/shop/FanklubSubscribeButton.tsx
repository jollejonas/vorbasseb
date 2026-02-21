"use client";

import { useState } from "react";
import type { Session } from "next-auth";

export function FanklubSubscribeButton({
  plan,
  session,
}: {
  plan: "monthly" | "yearly";
  session: Session | null;
}) {
  const [loading, setLoading] = useState(false);

  async function handleSubscribe() {
    if (!session) {
      window.location.href = "/login?callbackUrl=/fanklub";
      return;
    }

    setLoading(true);
    const res = await fetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });

    if (!res.ok) {
      alert("Noget gik galt. Prøv igen.");
      setLoading(false);
      return;
    }

    const { url } = await res.json();
    window.location.href = url;
  }

  return (
    <button
      onClick={handleSubscribe}
      disabled={loading}
      className="w-full bg-primary hover:bg-primary-dark text-secondary font-bold py-3 rounded-xl transition disabled:opacity-60"
    >
      {loading
        ? "Forbereder…"
        : session
          ? "Tilmeld nu"
          : "Log ind for at tilmelde"}
    </button>
  );
}
