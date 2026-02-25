"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Package, Truck } from "lucide-react";

// Non-terminal statuses only — CANCELLED and REFUNDED are reached via dedicated buttons
const STATUS_OPTIONS: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Afventer", color: "bg-yellow-100 text-yellow-700" },
  PAID: { label: "Betalt", color: "bg-blue-100 text-blue-700" },
  SHIPPED: { label: "Afsendt", color: "bg-purple-100 text-purple-700" },
  AWAITING_PICKUP: { label: "Afventer afhentning", color: "bg-orange-100 text-orange-700" },
  PICKUP_READY: { label: "Klar til afhentning", color: "bg-teal-100 text-teal-700" },
  DELIVERED: { label: "Leveret", color: "bg-green-100 text-green-700" },
};

const TERMINAL_LABELS: Record<string, { label: string; color: string }> = {
  CANCELLED: { label: "Annulleret", color: "bg-red-100 text-red-700" },
  REFUNDED: { label: "Refunderet", color: "bg-gray-100 text-gray-600" },
};

export function AdminOrderActions({
  orderId,
  initialStatus,
  initialTrackingNumber,
  initialRefunded,
  deliveryMethod,
}: {
  orderId: string;
  initialStatus: string;
  initialTrackingNumber: string | null;
  initialRefunded: boolean;
  deliveryMethod: "SHIPPING" | "PICKUP";
}) {
  const [status, setStatus] = useState(initialStatus);
  const [trackingNumber, setTrackingNumber] = useState(initialTrackingNumber ?? "");
  const [saving, setSaving] = useState(false);

  const isShipped = status === "SHIPPED";
  const isCancelled = status === "CANCELLED";
  const isRefunded = status === "REFUNDED";
  const isTerminal = isCancelled || isRefunded;

  async function patch(data: Record<string, unknown>) {
    setSaving(true);
    const res = await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error("Noget gik galt");
      return false;
    }
    return true;
  }

  async function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value;
    if (await patch({ status: newStatus })) {
      setStatus(newStatus);
      toast.success(`Status: ${STATUS_OPTIONS[newStatus]?.label ?? newStatus}`);
    }
  }

  async function handleCancel() {
    if (!confirm("Annullér denne ordre? Dette kan ikke fortrydes.")) return;
    if (await patch({ status: "CANCELLED", cancelledAt: new Date().toISOString() })) {
      setStatus("CANCELLED");
      toast.success("Ordre annulleret");
    }
  }

  async function handleRefund() {
    if (!confirm("Markér ordren som refunderet?")) return;
    // Set both status and refunded flag atomically
    if (await patch({ status: "REFUNDED", refunded: true })) {
      setStatus("REFUNDED");
      toast.success("Ordre refunderet");
    }
  }

  async function handleSaveTracking() {
    if (await patch({ trackingNumber: trackingNumber || null })) {
      toast.success("Sporingsnummer gemt");
    }
  }

  const activeBadge = STATUS_OPTIONS[status] ?? TERMINAL_LABELS[status];

  return (
    <div className="space-y-2 min-w-[200px]">
      {/* Delivery method badge */}
      <div className="flex items-center gap-1 text-xs text-gray-500">
        {deliveryMethod === "PICKUP" ? (
          <><Package size={13} /><span>Afhentning</span></>
        ) : (
          <><Truck size={13} /><span>Levering</span></>
        )}
      </div>

      {/* Status badge */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${activeBadge?.color ?? "bg-gray-100 text-gray-600"}`}>
          {activeBadge?.label ?? status}
        </span>

        {/* Dropdown only for non-terminal statuses */}
        {!isTerminal && (
          <select
            value={status}
            onChange={handleStatusChange}
            disabled={saving}
            className="border rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-secondary disabled:opacity-60"
          >
            {Object.entries(STATUS_OPTIONS).map(([value, { label }]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        )}
      </div>

      {/* Tracking number — only when SHIPPED */}
      {isShipped && deliveryMethod === "SHIPPING" && (
        <div className="flex gap-1">
          <input
            type="text"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            placeholder="Sporingsnummer"
            className="border rounded-lg px-2 py-1 text-xs flex-1 focus:outline-none focus:ring-2 focus:ring-secondary"
          />
          <button
            onClick={handleSaveTracking}
            disabled={saving}
            className="text-xs bg-secondary text-white px-2 py-1 rounded-lg hover:bg-secondary-dark disabled:opacity-60 transition"
          >
            Gem
          </button>
        </div>
      )}

      {/* Cancel button — only for active orders */}
      {!isTerminal && (
        <button
          onClick={handleCancel}
          disabled={saving}
          className="text-xs text-red-500 underline hover:text-red-700 disabled:opacity-60 transition"
        >
          Annullér ordre
        </button>
      )}

      {/* Refund button — only after cancellation */}
      {isCancelled && (
        <button
          onClick={handleRefund}
          disabled={saving}
          className="block text-xs text-orange-600 underline hover:text-orange-800 disabled:opacity-60 transition"
        >
          Markér som refunderet
        </button>
      )}
    </div>
  );
}
