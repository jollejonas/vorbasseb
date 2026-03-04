"use client";

import { useState } from "react";
import { Gift, Users, X } from "lucide-react";
import { toast } from "sonner";

type Product = { id: string; name: string };

type OrderedItem = {
  productId: string;
  productName: string;
  size: string | null;
};

type Trainer = {
  id: string;
  name: string | null;
  email: string;
  orderedItems: OrderedItem[];
  lastOrderDate: string | null; // ISO string
};

type Grant = {
  id: string;
  userId: string;
  productId: string;
  user: { id: string; name: string | null; email: string };
  product: { id: string; name: string };
  createdAt: string; // ISO string
};

export function TrainerAdminClient({
  trainers,
  trainerProducts,
  initialGrants,
  initialBulkEligibleProducts,
}: {
  trainers: Trainer[];
  trainerProducts: Product[];
  initialGrants: Grant[];
  initialBulkEligibleProducts: Product[];
}) {
  const [filter, setFilter] = useState<"all" | "ordered" | "notOrdered">("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [grants, setGrants] = useState<Grant[]>(initialGrants);
  const [bulkProducts, setBulkProducts] = useState<Product[]>(initialBulkEligibleProducts);
  const [bulkProductId, setBulkProductId] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [grantUserId, setGrantUserId] = useState("");
  const [grantProductId, setGrantProductId] = useState("");
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  // --- Filtering ---
  const filtered = trainers.filter((t) => {
    const hasOrdered = (pid: string) => t.orderedItems.some((i) => i.productId === pid);

    if (productFilter !== "all") {
      if (filter === "ordered") return hasOrdered(productFilter);
      if (filter === "notOrdered") return !hasOrdered(productFilter);
      return true;
    }
    if (filter === "ordered") return trainerProducts.some((p) => hasOrdered(p.id));
    if (filter === "notOrdered") return trainerProducts.every((p) => !hasOrdered(p.id));
    return true;
  });

  // --- Bulk grant ---
  async function handleBulkGrant() {
    if (!bulkProductId) return;
    setBulkLoading(true);
    const res = await fetch("/api/admin/grants/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: bulkProductId }),
    });
    setBulkLoading(false);

    if (!res.ok) {
      toast.error("Noget gik galt ved bulk-tildeling");
      return;
    }

    const data = await res.json();
    toast.success(
      data.created === 0
        ? "Alle trænere har allerede denne tildeling"
        : `${data.created} tildeling${data.created !== 1 ? "er" : ""} oprettet`
    );

    // Remove product from bulk eligible list
    setBulkProducts((prev) => prev.filter((p) => p.id !== bulkProductId));
    setBulkProductId("");

    // Refresh grants list
    const grantsRes = await fetch("/api/admin/grants?status=PENDING").catch(() => null);
    if (grantsRes?.ok) {
      const grantsData = await grantsRes.json();
      setGrants(
        grantsData.grants.map((g: Grant & { createdAt: Date | string }) => ({
          ...g,
          createdAt: typeof g.createdAt === "string" ? g.createdAt : new Date(g.createdAt).toISOString(),
        }))
      );
    }
  }

  // --- Individual grant ---
  async function handleCreateGrant() {
    if (!grantUserId || !grantProductId) return;
    setCreating(true);
    const res = await fetch("/api/admin/grants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: grantUserId, productId: grantProductId }),
    });
    setCreating(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Noget gik galt");
      return;
    }

    const { grant } = await res.json();
    setGrants((prev) => [
      {
        ...grant,
        createdAt: typeof grant.createdAt === "string" ? grant.createdAt : new Date(grant.createdAt).toISOString(),
      },
      ...prev,
    ]);
    // If product now has pending grants, remove from bulk list
    setBulkProducts((prev) => prev.filter((p) => p.id !== grantProductId));
    setGrantUserId("");
    setGrantProductId("");
    toast.success("Tildeling oprettet");
  }

  // --- Revoke grant ---
  async function handleRevoke(id: string) {
    setRevoking(id);
    const res = await fetch(`/api/admin/grants/${id}`, { method: "DELETE" });
    setRevoking(null);

    if (!res.ok) {
      toast.error("Kunne ikke tilbagekalde tildelingen");
      return;
    }

    const revoked = grants.find((g) => g.id === id);
    setGrants((prev) => prev.filter((g) => g.id !== id));

    // If no more pending grants for this product, add it back to bulk list
    if (revoked) {
      const remainingForProduct = grants.filter(
        (g) => g.id !== id && g.productId === revoked.productId
      );
      if (remainingForProduct.length === 0) {
        const product = trainerProducts.find((p) => p.id === revoked.productId);
        if (product && !bulkProducts.some((bp) => bp.id === product.id)) {
          setBulkProducts((prev) => [...prev, product]);
        }
      }
    }

    toast.success("Tildeling tilbagekaldt");
  }

  const filterBtn = (value: typeof filter, label: string) => (
    <button
      onClick={() => setFilter(value)}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
        filter === value
          ? "bg-secondary text-white"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-10">
      {/* ── Trainer table ── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Users size={18} className="text-secondary" />
          <h2 className="text-lg font-bold">Trænere</h2>
          <span className="text-sm text-gray-400">({filtered.length} / {trainers.length})</span>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="flex gap-1.5">
            {filterBtn("all", "Alle")}
            {filterBtn("ordered", "Har bestilt")}
            {filterBtn("notOrdered", "Mangler at bestille")}
          </div>
          {trainerProducts.length > 1 && (
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
            >
              <option value="all">Alle produkter</option>
              {trainerProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Ingen trænere matcher filteret.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b text-left text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Træner</th>
                  <th className="px-4 py-3 font-medium">Bestilte produkter</th>
                  <th className="px-4 py-3 font-medium">Aktive tildelinger</th>
                  <th className="px-4 py-3 font-medium">Sidst bestilt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((trainer) => {
                  const trainerPendingGrants = grants.filter((g) => g.userId === trainer.id);
                  const displayedItems =
                    productFilter !== "all"
                      ? trainer.orderedItems.filter((i) => i.productId === productFilter)
                      : trainer.orderedItems;

                  return (
                    <tr key={trainer.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium">{trainer.name ?? "–"}</p>
                        <p className="text-xs text-gray-400">{trainer.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        {displayedItems.length === 0 ? (
                          <span className="text-gray-300">–</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {displayedItems.map((item, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium"
                              >
                                {item.productName}
                                {item.size && (
                                  <span className="font-mono font-bold">{item.size}</span>
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {trainerPendingGrants.length === 0 ? (
                          <span className="text-gray-300">–</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {trainerPendingGrants.map((g) => (
                              <span
                                key={g.id}
                                className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-xs px-2 py-0.5 rounded-full font-medium"
                              >
                                <Gift size={10} />
                                {g.product.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {trainer.lastOrderDate
                          ? new Date(trainer.lastOrderDate).toLocaleDateString("da-DK", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : <span className="text-gray-300">–</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Bulk grant ── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Gift size={18} className="text-secondary" />
          <h2 className="text-lg font-bold">Tildel produkt til alle trænere</h2>
        </div>

        <div className="bg-surface rounded-xl p-5">
          {bulkProducts.length === 0 ? (
            <p className="text-sm text-gray-500">
              Alle trænerprodukter har allerede aktive tildelinger til alle trænere.
            </p>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-3">
                Vælg et produkt for at oprette en gratis tildeling til samtlige trænere på én gang.
                Kun produkter uden eksisterende aktive tildelinger vises.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <select
                  value={bulkProductId}
                  onChange={(e) => setBulkProductId(e.target.value)}
                  className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
                >
                  <option value="">Vælg produkt…</option>
                  {bulkProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleBulkGrant}
                  disabled={!bulkProductId || bulkLoading}
                  className="bg-secondary text-white font-semibold px-5 py-2 rounded-lg text-sm hover:bg-secondary-dark transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {bulkLoading ? "Opretter…" : `Tildel til alle ${trainers.length} trænere`}
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      {/* ── Individual grant ── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Gift size={18} className="text-secondary" />
          <h2 className="text-lg font-bold">Tildel enkelt produkt</h2>
        </div>

        <div className="bg-surface rounded-xl p-5 mb-6">
          <p className="text-sm font-semibold text-gray-700 mb-3">Tildel gratis produkt til én træner</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={grantUserId}
              onChange={(e) => setGrantUserId(e.target.value)}
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
              value={grantProductId}
              onChange={(e) => setGrantProductId(e.target.value)}
              className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
            >
              <option value="">Vælg produkt…</option>
              {trainerProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleCreateGrant}
              disabled={!grantUserId || !grantProductId || creating}
              className="bg-secondary text-white font-semibold px-5 py-2 rounded-lg text-sm hover:bg-secondary-dark transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {creating ? "Tildeler…" : "Tildel"}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Træneren vælger størrelse selv ved checkout. Tildelingen bruges automatisk.
          </p>
        </div>

        {/* Pending grants list */}
        {grants.length === 0 ? (
          <p className="text-sm text-gray-400">Ingen afventende tildelinger.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full text-sm">
              <thead className="bg-surface border-b">
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
                        onClick={() => handleRevoke(g.id)}
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
      </section>
    </div>
  );
}
