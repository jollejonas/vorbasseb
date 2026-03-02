"use client";

import { useState } from "react";
import { Gift, X } from "lucide-react";

type Trainer = { id: string; name: string | null; email: string };
type Product = { id: string; name: string };
type Grant = {
  id: string;
  userId: string;
  productId: string;
  user: { name: string | null; email: string };
  product: { name: string };
  createdAt: string;
};

export function GrantManager({
  trainers,
  products,
  initialGrants,
}: {
  trainers: Trainer[];
  products: Product[];
  initialGrants: Grant[];
}) {
  const [grants, setGrants] = useState<Grant[]>(initialGrants);
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  async function createGrant() {
    if (!selectedUser || !selectedProduct) return;
    setCreating(true);

    const res = await fetch("/api/admin/grants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: selectedUser, productId: selectedProduct }),
    });

    setCreating(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Noget gik galt");
      return;
    }

    const { grant } = await res.json();
    setGrants((prev) => [grant, ...prev]);
    setSelectedUser("");
    setSelectedProduct("");
  }

  async function revokeGrant(id: string) {
    setRevoking(id);
    const res = await fetch(`/api/admin/grants/${id}`, { method: "DELETE" });
    setRevoking(null);

    if (!res.ok) {
      alert("Kunne ikke tilbagekalde tildelingen");
      return;
    }

    setGrants((prev) => prev.filter((g) => g.id !== id));
  }

  return (
    <div className="mt-10">
      <div className="flex items-center gap-2 mb-4">
        <Gift size={18} className="text-secondary" />
        <h2 className="text-lg font-bold">Tildelinger (gratis produkter)</h2>
      </div>

      {/* Create form */}
      <div className="bg-surface rounded-xl p-5 mb-6">
        <p className="text-sm font-semibold text-gray-700 mb-3">Tildel gratis produkt til træner</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
          >
            <option value="">Vælg træner…</option>
            {trainers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name ?? t.email} ({t.email})
              </option>
            ))}
          </select>
          <select
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
          >
            <option value="">Vælg produkt…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            onClick={createGrant}
            disabled={!selectedUser || !selectedProduct || creating}
            className="bg-secondary text-white font-semibold px-5 py-2 rounded-lg text-sm hover:bg-secondary-dark transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {creating ? "Tildeler…" : "Tildel"}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Træneren vælger størrelse selv ved checkout. Tildelingen bruges automatisk når de bestiller det valgte produkt.
        </p>
      </div>

      {/* Pending grants table */}
      {grants.length === 0 ? (
        <p className="text-sm text-gray-400">Ingen afventende tildelinger.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-surface">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Træner</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Produkt</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Oprettet</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {grants.map((g) => (
                <tr key={g.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium">{g.user.name ?? "–"}</p>
                    <p className="text-xs text-gray-400">{g.user.email}</p>
                  </td>
                  <td className="px-4 py-3">{g.product.name}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(g.createdAt).toLocaleDateString("da-DK", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => revokeGrant(g.id)}
                      disabled={revoking === g.id}
                      className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition disabled:opacity-50"
                    >
                      <X size={14} />
                      Tilbagekald
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
