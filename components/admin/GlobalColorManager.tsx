"use client";

import { useState } from "react";

type GlobalColor = {
  id: string;
  name: string;
  hex: string;
  code: string;
  position: number;
};

type Props = { initialColors: GlobalColor[] };

const EMPTY_FORM = { name: "", hex: "#000000", code: "", position: 0 };

export function GlobalColorManager({ initialColors }: Props) {
  const [colors, setColors] = useState<GlobalColor[]>(initialColors);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function startEdit(c: GlobalColor) {
    setEditId(c.id);
    setForm({ name: c.name, hex: c.hex, code: c.code, position: c.position });
    setError("");
  }

  function cancelEdit() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setError("");
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      if (editId) {
        const res = await fetch(`/api/admin/global-colors/${editId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        const updated: GlobalColor = await res.json();
        setColors((prev) => prev.map((c) => (c.id === editId ? updated : c)));
        cancelEdit();
      } else {
        const res = await fetch("/api/admin/global-colors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        const created: GlobalColor = await res.json();
        setColors((prev) => [...prev, created].sort((a, b) => a.position - b.position));
        setForm(EMPTY_FORM);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fejl");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Slet farve?")) return;
    setError("");
    const res = await fetch(`/api/admin/global-colors/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error);
      return;
    }
    setColors((prev) => prev.filter((c) => c.id !== id));
    if (editId === id) cancelEdit();
  }

  return (
    <div className="space-y-8">
      {/* Color list */}
      <div className="border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b text-left text-gray-500">
              <th className="px-4 py-2 font-medium">Farve</th>
              <th className="px-4 py-2 font-medium">Navn</th>
              <th className="px-4 py-2 font-medium">Kode</th>
              <th className="px-4 py-2 font-medium">Position</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {colors.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  Ingen farver endnu
                </td>
              </tr>
            )}
            {colors.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-2">
                  <span
                    className="inline-block w-7 h-7 rounded-full border border-gray-200"
                    style={{ background: c.hex }}
                  />
                </td>
                <td className="px-4 py-2 font-medium">{c.name}</td>
                <td className="px-4 py-2 font-mono text-gray-500">{c.code}</td>
                <td className="px-4 py-2 text-gray-500">{c.position}</td>
                <td className="px-4 py-2 text-right space-x-2">
                  <button
                    onClick={() => startEdit(c)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Rediger
                  </button>
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Slet
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Form */}
      <div className="border rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-gray-700">
          {editId ? "Rediger farve" : "Tilføj ny farve"}
        </h2>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="grid sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Farve</label>
            <input
              type="color"
              value={form.hex}
              onChange={(e) => setForm((f) => ({ ...f, hex: e.target.value }))}
              className="h-10 w-full cursor-pointer rounded border border-gray-200 p-0.5"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Navn</label>
            <input
              type="text"
              placeholder="Rød"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Kode (2 cifre)
            </label>
            <input
              type="text"
              placeholder="03"
              maxLength={2}
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Position</label>
            <input
              type="number"
              value={form.position}
              onChange={(e) => setForm((f) => ({ ...f, position: parseInt(e.target.value) || 0 }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving || !form.name || !form.code}
            className="bg-secondary text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Gemmer…" : editId ? "Gem ændringer" : "Tilføj farve"}
          </button>
          {editId && (
            <button
              onClick={cancelEdit}
              className="border border-gray-200 px-4 py-2 rounded-lg text-sm"
            >
              Annuller
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
