"use client";

import { useState } from "react";

type SizePreset = { id: string; label: string; position: number };
type Props = { initialSizes: SizePreset[] };

export function SizePresetManager({ initialSizes }: Props) {
  const [sizes, setSizes] = useState<SizePreset[]>(initialSizes);
  const [newLabel, setNewLabel] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!newLabel.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/size-presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newLabel.trim(), position: sizes.length }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const created: SizePreset = await res.json();
      setSizes((prev) => [...prev, created]);
      setNewLabel("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fejl");
    } finally {
      setSaving(false);
    }
  }

  async function handleEditSave(id: string) {
    if (!editLabel.trim()) return;
    setSaving(true);
    setError("");
    try {
      const size = sizes.find((s) => s.id === id)!;
      const res = await fetch(`/api/admin/size-presets/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: editLabel.trim(), position: size.position }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const updated: SizePreset = await res.json();
      setSizes((prev) => prev.map((s) => (s.id === id ? updated : s)));
      setEditId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fejl");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Slet størrelse?")) return;
    setError("");
    const res = await fetch(`/api/admin/size-presets/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError((await res.json()).error ?? "Kunne ikke slette");
      return;
    }
    setSizes((prev) => prev.filter((s) => s.id !== id));
    if (editId === id) setEditId(null);
  }

  async function move(id: string, dir: -1 | 1) {
    const idx = sizes.findIndex((s) => s.id === id);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= sizes.length) return;

    const reordered = [...sizes];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    const updated = reordered.map((s, i) => ({ ...s, position: i }));
    setSizes(updated);

    // Persist both affected sizes
    await Promise.all([
      fetch(`/api/admin/size-presets/${updated[idx].id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: updated[idx].label, position: updated[idx].position }),
      }),
      fetch(`/api/admin/size-presets/${updated[newIdx].id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: updated[newIdx].label, position: updated[newIdx].position }),
      }),
    ]);
  }

  return (
    <div className="space-y-8">
      {/* List */}
      <div className="border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b text-left text-gray-500">
              <th className="px-4 py-2 font-medium">Størrelse</th>
              <th className="px-4 py-2 font-medium">Rækkefølge</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sizes.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-400">
                  Ingen størrelser endnu
                </td>
              </tr>
            )}
            {sizes.map((s, idx) => (
              <tr key={s.id}>
                <td className="px-4 py-2 font-medium">
                  {editId === s.id ? (
                    <input
                      autoFocus
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleEditSave(s.id);
                        if (e.key === "Escape") setEditId(null);
                      }}
                      className="border border-gray-200 rounded px-2 py-1 text-sm w-24"
                    />
                  ) : (
                    s.label
                  )}
                </td>
                <td className="px-4 py-2">
                  <div className="flex gap-1">
                    <button
                      onClick={() => move(s.id, -1)}
                      disabled={idx === 0}
                      className="px-1.5 py-0.5 text-xs border rounded disabled:opacity-30 hover:bg-gray-50"
                      title="Flyt op"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => move(s.id, 1)}
                      disabled={idx === sizes.length - 1}
                      className="px-1.5 py-0.5 text-xs border rounded disabled:opacity-30 hover:bg-gray-50"
                      title="Flyt ned"
                    >
                      ↓
                    </button>
                  </div>
                </td>
                <td className="px-4 py-2 text-right space-x-2">
                  {editId === s.id ? (
                    <>
                      <button
                        onClick={() => handleEditSave(s.id)}
                        disabled={saving}
                        className="text-xs text-green-600 hover:underline"
                      >
                        Gem
                      </button>
                      <button
                        onClick={() => setEditId(null)}
                        className="text-xs text-gray-500 hover:underline"
                      >
                        Annuller
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => { setEditId(s.id); setEditLabel(s.label); }}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Rediger
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Slet
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Add new */}
      <div className="border rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-gray-700">Tilføj ny størrelse</h2>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="f.eks. 3XL eller 176"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={handleAdd}
            disabled={saving || !newLabel.trim()}
            className="bg-secondary text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Tilføjer…" : "Tilføj"}
          </button>
        </div>
      </div>
    </div>
  );
}
