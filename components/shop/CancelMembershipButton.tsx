"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CancelMembershipButton() {
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleCancel() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/membership", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Noget gik galt. Prøv igen.");
        return;
      }
      router.refresh();
    } catch {
      setError("Noget gik galt. Prøv igen.");
    } finally {
      setLoading(false);
      setShowConfirm(false);
    }
  }

  if (showConfirm) {
    return (
      <div className="border border-red-200 rounded-xl p-4 space-y-3">
        <p className="text-sm text-gray-700">
          Er du sikker på, at du vil annullere dit abonnement? Dit medlemskab forbliver aktivt til udgangen af den nuværende periode.
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleCancel}
            disabled={loading}
            className="bg-red-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-red-700 transition disabled:opacity-50"
          >
            {loading ? "Annullerer…" : "Ja, annuller abonnement"}
          </button>
          <button
            onClick={() => setShowConfirm(false)}
            disabled={loading}
            className="text-sm text-gray-600 px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition"
          >
            Fortryd
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className="text-sm text-red-600 hover:text-red-700 underline underline-offset-2 transition"
    >
      Annuller abonnement
    </button>
  );
}
