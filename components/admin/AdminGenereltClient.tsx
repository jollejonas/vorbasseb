"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { SiteSetting } from "@prisma/client";

const SETTING_LABELS: Record<string, string> = {
  vat_rate: "Momssats (%)",
  footer_phone: "Telefon (footer)",
  footer_email: "E-mail (footer)",
  shipping_flat_ore: "Fast fragtgebyr (øre)",
  shipping_free_ore: "Gratis fragt fra (øre)",
  member_discount_pct: "Fanklubsrabat (%)",
  delivery_banner: "Leveringsbanner tekst (tom = skjult)",
};

const SETTING_KEYS = Object.keys(SETTING_LABELS);

export function AdminGenereltClient({ settings }: { settings: SiteSetting[] }) {
  const router = useRouter();
  const [settingsMap, setSettingsMap] = useState<Record<string, string>>(
    Object.fromEntries(settings.map((s) => [s.key, s.value]))
  );
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = SETTING_KEYS.map((key) => ({ key, value: settingsMap[key] ?? "" }));
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: payload }),
      });
      if (!res.ok) throw new Error();
      toast.success("Indstillinger gemt");
      router.refresh();
    } catch {
      toast.error("Noget gik galt");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="max-w-lg space-y-4">
      {SETTING_KEYS.map((key) => (
        <div key={key}>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {SETTING_LABELS[key]}
          </label>
          <input
            type="text"
            value={settingsMap[key] ?? ""}
            onChange={(e) => setSettingsMap((prev) => ({ ...prev, [key]: e.target.value }))}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
          />
        </div>
      ))}
      <div className="pt-2">
        <button
          type="submit"
          disabled={saving}
          className="bg-primary text-secondary font-bold px-6 py-2 rounded-xl hover:bg-primary-dark transition text-sm disabled:opacity-50"
        >
          {saving ? "Gemmer..." : "Gem indstillinger"}
        </button>
      </div>
    </form>
  );
}
