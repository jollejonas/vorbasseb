"use client";

import { useState } from "react";
import { toast } from "sonner";

type Role = "CUSTOMER" | "ADMIN";

export function UserProfileForm({
  userId,
  initialName,
  initialEmail,
  initialRole,
}: {
  userId: string;
  initialName: string;
  initialEmail: string;
  initialRole: Role;
}) {
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [role, setRole] = useState<Role>(initialRole);
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role }),
      });
      if (!res.ok) throw new Error();
      toast.success("Bruger opdateret");
    } catch {
      toast.error("Noget gik galt");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-3">
      <div>
        <label className="block text-xs text-gray-500 mb-1">Navn</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
          placeholder="Navn"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">E-mail</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
          placeholder="E-mail"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Rolle</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
        >
          <option value="CUSTOMER">Kunde</option>
          <option value="ADMIN">Admin</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={saving}
        className="bg-secondary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-secondary-dark transition disabled:opacity-50"
      >
        {saving ? "Gemmer…" : "Gem ændringer"}
      </button>
    </form>
  );
}

export function MembershipButton({
  userId,
  action,
}: {
  userId: string;
  action: "grant" | "revoke";
}) {
  const [saving, setSaving] = useState(false);
  const isGrant = action === "grant";

  async function handleClick() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipAction: action }),
      });
      if (!res.ok) throw new Error();
      toast.success(isGrant ? "Medlemskab tildelt" : "Medlemskab tilbagekaldt");
      window.location.reload();
    } catch {
      toast.error("Noget gik galt");
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={saving}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 ${
        isGrant
          ? "bg-green-600 text-white hover:bg-green-700"
          : "bg-red-100 text-red-700 hover:bg-red-200"
      }`}
    >
      {saving
        ? "Gemmer…"
        : isGrant
          ? "Tildel medlemskab"
          : "Tilbagekald medlemskab"}
    </button>
  );
}
