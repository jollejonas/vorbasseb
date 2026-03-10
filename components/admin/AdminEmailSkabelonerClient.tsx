"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { SiteSetting } from "@prisma/client";

const EMAIL_TEMPLATE_KEYS = [
  "email_order_subject",
  "email_order_body",
  "email_shipping_subject",
  "email_shipping_body",
] as const;

const EMAIL_VARS: Record<string, string[]> = {
  email_order_body: ["{{customerName}}", "{{items}}", "{{total}}"],
  email_shipping_body: ["{{customerName}}", "{{orderId}}", "{{trackingNumber}}", "{{items}}"],
};

export function AdminEmailSkabelonerClient({ settings }: { settings: SiteSetting[] }) {
  const [templates, setTemplates] = useState<Record<string, string>>(
    Object.fromEntries(settings.map((s) => [s.key, s.value]))
  );
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = EMAIL_TEMPLATE_KEYS.map((key) => ({ key, value: templates[key] ?? "" }));
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: payload }),
      });
      if (!res.ok) throw new Error();
      toast.success("E-mail skabeloner gemt");
    } catch {
      toast.error("Noget gik galt");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-8 max-w-2xl">
      {/* Order confirmation */}
      <div className="border rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-gray-800">Ordrebekræftelse</h2>
        <p className="text-xs text-gray-400">Sendes automatisk til kunden når betaling er gennemført.</p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Emnelinje</label>
          <input
            type="text"
            value={templates["email_order_subject"] ?? ""}
            onChange={(e) => setTemplates((p) => ({ ...p, email_order_subject: e.target.value }))}
            placeholder="Ordrebekræftelse – Vorbasse Boldklub"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Brødtekst (HTML)</label>
          <textarea
            rows={10}
            value={templates["email_order_body"] ?? ""}
            onChange={(e) => setTemplates((p) => ({ ...p, email_order_body: e.target.value }))}
            className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-secondary resize-y"
            placeholder="<h2>Tak for din ordre!</h2>..."
          />
          <div className="mt-1.5 flex flex-wrap gap-1.5 items-center">
            <span className="text-xs text-gray-400">Variabler:</span>
            {EMAIL_VARS["email_order_body"].map((v) => (
              <code key={v} className="text-xs bg-gray-100 border rounded px-1.5 py-0.5 font-mono text-gray-600">{v}</code>
            ))}
          </div>
        </div>
      </div>

      {/* Shipping notification */}
      <div className="border rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-gray-800">Forsendelsesbekræftelse</h2>
        <p className="text-xs text-gray-400">Sendes til kunden når du markerer en ordre som &quot;Afsendt&quot;.</p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Emnelinje</label>
          <input
            type="text"
            value={templates["email_shipping_subject"] ?? ""}
            onChange={(e) => setTemplates((p) => ({ ...p, email_shipping_subject: e.target.value }))}
            placeholder="Din ordre er afsendt – Vorbasse Boldklub"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Brødtekst (HTML)</label>
          <textarea
            rows={10}
            value={templates["email_shipping_body"] ?? ""}
            onChange={(e) => setTemplates((p) => ({ ...p, email_shipping_body: e.target.value }))}
            className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-secondary resize-y"
            placeholder="<h2>Din ordre er på vej!</h2>..."
          />
          <div className="mt-1.5 flex flex-wrap gap-1.5 items-center">
            <span className="text-xs text-gray-400">Variabler:</span>
            {EMAIL_VARS["email_shipping_body"].map((v) => (
              <code key={v} className="text-xs bg-gray-100 border rounded px-1.5 py-0.5 font-mono text-gray-600">{v}</code>
            ))}
          </div>
        </div>
      </div>

      <div>
        <button
          type="submit"
          disabled={saving}
          className="bg-primary text-secondary font-bold px-6 py-2 rounded-xl hover:bg-primary-dark transition text-sm disabled:opacity-50"
        >
          {saving ? "Gemmer..." : "Gem e-mail skabeloner"}
        </button>
      </div>
    </form>
  );
}
