"use client";

import { useState } from "react";
import { ChevronUp, ChevronDown, Pencil, Trash2, Plus, Check, X } from "lucide-react";

type SubCategoryWithCount = {
  id: string;
  name: string;
  slug: string;
  position: number;
  parentId: string | null;
  _count: { products: number };
};

type CategoryWithCount = {
  id: string;
  name: string;
  slug: string;
  position: number;
  parentId: string | null;
  _count: { products: number };
  children: SubCategoryWithCount[];
};

type Props = { initialCategories: CategoryWithCount[] };

export function CategoryManager({ initialCategories }: Props) {
  const [categories, setCategories] = useState<CategoryWithCount[]>(initialCategories);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [addingTo, setAddingTo] = useState<string | "root" | null>(null);
  const [newName, setNewName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string; affectedProducts?: number } | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function reload() {
    const res = await fetch("/api/admin/categories");
    if (res.ok) setCategories(await res.json());
  }

  async function handleAdd(parentId: string | null) {
    if (!newName.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), parentId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setNewName("");
      setAddingTo(null);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fejl");
    } finally {
      setSaving(false);
    }
  }

  async function handleRename(id: string) {
    if (!editName.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/categories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setEditId(null);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fejl");
    } finally {
      setSaving(false);
    }
  }

  async function handleMove(id: string, direction: "up" | "down") {
    setSaving(true);
    try {
      await fetch(`/api/admin/categories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction }),
      });
      await reload();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/categories/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setConfirmDelete(null);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fejl");
    } finally {
      setSaving(false);
    }
  }

  function startDelete(cat: CategoryWithCount | SubCategoryWithCount) {
    const childTotal = "children" in cat ? cat.children.reduce((sum, c) => sum + c._count.products, 0) : 0;
    const total = cat._count.products + childTotal;
    setConfirmDelete({ id: cat.id, name: cat.name, affectedProducts: total });
  }

  function renderRow(
    cat: CategoryWithCount | SubCategoryWithCount,
    siblings: (CategoryWithCount | SubCategoryWithCount)[],
    idx: number,
    isChild: boolean
  ) {
    const isFirst = idx === 0;
    const isLast = idx === siblings.length - 1;
    const isEditing = editId === cat.id;
    const isAdding = addingTo === cat.id;

    return (
      <div key={cat.id}>
        <div className={`flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-50 ${isChild ? "ml-6 border-l-2 border-gray-200 pl-4" : "border border-gray-100 bg-white shadow-sm"}`}>
          {isEditing ? (
            <>
              <input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleRename(cat.id); if (e.key === "Escape") setEditId(null); }}
                className="flex-1 border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
              />
              <button onClick={() => handleRename(cat.id)} disabled={saving} className="text-green-600 hover:text-green-700"><Check size={16} /></button>
              <button onClick={() => setEditId(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </>
          ) : (
            <>
              <span className={`flex-1 text-sm font-medium ${isChild ? "text-gray-600" : "text-gray-900"}`}>
                {isChild && <span className="text-gray-400 mr-1">↳</span>}
                {cat.name}
                {cat._count.products > 0 && (
                  <span className="ml-2 text-xs text-gray-400 font-normal">({cat._count.products})</span>
                )}
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => handleMove(cat.id, "up")} disabled={isFirst || saving} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronUp size={14} /></button>
                <button onClick={() => handleMove(cat.id, "down")} disabled={isLast || saving} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronDown size={14} /></button>
                <button onClick={() => { setEditId(cat.id); setEditName(cat.name); setError(""); }} className="p-1 text-gray-400 hover:text-secondary"><Pencil size={14} /></button>
                <button onClick={() => startDelete(cat)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
              </div>
            </>
          )}
        </div>

        {"children" in cat && cat.children.length > 0 && (
          <div className="mt-1 space-y-1">
            {cat.children.map((child, ci) =>
              renderRow(child, cat.children, ci, true)
            )}
          </div>
        )}

        {!isChild && (
          <div className="ml-6 mt-1">
            {isAdding ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAdd(cat.id); if (e.key === "Escape") { setAddingTo(null); setNewName(""); } }}
                  placeholder="Underkategorinavn..."
                  className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
                />
                <button onClick={() => handleAdd(cat.id)} disabled={saving} className="text-green-600 hover:text-green-700"><Check size={16} /></button>
                <button onClick={() => { setAddingTo(null); setNewName(""); }} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
              </div>
            ) : (
              <button onClick={() => { setAddingTo(cat.id); setNewName(""); setError(""); }} className="flex items-center gap-1 text-xs text-gray-400 hover:text-secondary py-1">
                <Plus size={12} /> Tilføj underkategori
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}

      {categories.map((cat, i) =>
        renderRow(cat, categories, i, false)
      )}

      <div className="pt-2">
        {addingTo === "root" ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(null); if (e.key === "Escape") { setAddingTo(null); setNewName(""); } }}
              placeholder="Kategorinavn..."
              className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
            />
            <button onClick={() => handleAdd(null)} disabled={saving} className="text-green-600 hover:text-green-700"><Check size={16} /></button>
            <button onClick={() => { setAddingTo(null); setNewName(""); }} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
          </div>
        ) : (
          <button onClick={() => { setAddingTo("root"); setNewName(""); setError(""); }} className="flex items-center gap-2 text-sm text-secondary hover:underline font-medium">
            <Plus size={14} /> Tilføj kategori
          </button>
        )}
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="font-semibold text-gray-900 mb-2">Slet &quot;{confirmDelete.name}&quot;?</h3>
            {confirmDelete.affectedProducts !== undefined && confirmDelete.affectedProducts > 0 && (
              <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-4">
                {confirmDelete.affectedProducts} {confirmDelete.affectedProducts === 1 ? "produkt bruger" : "produkter bruger"} denne kategori. De vil miste deres kategoritildeling.
              </p>
            )}
            <p className="text-sm text-gray-500 mb-4">Denne handling kan ikke fortrydes.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">Annuller</button>
              <button onClick={() => handleDelete(confirmDelete.id)} disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                {saving ? "Sletter..." : "Slet"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
