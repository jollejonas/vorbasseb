"use client";

import { useState } from "react";
import { toast } from "sonner";

export function OrderStatusSelect({
  orderId,
  currentStatus,
  labels,
}: {
  orderId: string;
  currentStatus: string;
  labels: Record<string, string>;
}) {
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value;
    setLoading(true);

    const res = await fetch(`/api/orders/${orderId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });

    setLoading(false);

    if (!res.ok) {
      toast.error("Kunne ikke opdatere status");
      return;
    }

    setStatus(newStatus);
    toast.success(`Status opdateret til: ${labels[newStatus] ?? newStatus}`);
  }

  return (
    <select
      value={status}
      onChange={handleChange}
      disabled={loading}
      className="border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary disabled:opacity-60"
    >
      {Object.entries(labels).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}
