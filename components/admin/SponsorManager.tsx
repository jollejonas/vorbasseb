"use client";

import { useRef, useState } from "react";
import { useCloudinaryWidgetScript } from "@/lib/useCloudinaryWidgetScript";

type Sponsor = { id: string; name: string; logoUrl: string; websiteUrl: string | null; position: number };
type Props = { initialSponsors: Sponsor[]; initialHeading: string };

const EMPTY_FORM = { name: "", logoUrl: "", websiteUrl: "" };

export function SponsorManager({ initialSponsors, initialHeading }: Props) {
  const [sponsors, setSponsors] = useState<Sponsor[]>(initialSponsors);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [heading, setHeading] = useState(initialHeading);
  const [headingSaving, setHeadingSaving] = useState(false);
  const { scriptReady, scriptError } = useCloudinaryWidgetScript();
  const widgetRef = useRef<{ open: () => void } | null>(null);

  function openCloudinaryWidget() {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim();
    const uploadPreset = process.env.NEXT_PUBLIC_UPLOAD_PRESET?.trim();
    const missingEnvVars: string[] = [];
    if (!cloudName) missingEnvVars.push("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME");
    if (!uploadPreset) missingEnvVars.push("NEXT_PUBLIC_UPLOAD_PRESET");
    if (missingEnvVars.length > 0) {
      setError(
        `Cloudinary er ikke konfigureret. Mangler: ${missingEnvVars.join(", ")} i .env.local (genstart server bagefter).`
      );
      return;
    }

    if (!scriptReady) {
      setError(scriptError ?? "Upload-widget er ikke klar endnu – prøv igen om et øjeblik");
      return;
    }

    try {
      setError("");

      if (!widgetRef.current) {
        // @ts-expect-error cloudinary global
        const cloudinary = window.cloudinary;
        if (!cloudinary?.createUploadWidget) {
          setError("Cloudinary widget er ikke tilgængelig endnu. Genindlæs siden og prøv igen.");
          return;
        }

        const createdWidget = cloudinary.createUploadWidget(
          { cloudName, uploadPreset, multiple: false, resourceType: "image", folder: "vbk-sponsorer", clientAllowedFormats: ["jpg", "jpeg", "png", "webp", "svg"], maxFileSize: 5000000 },
          (
            error: unknown,
            result?: { event?: string; info?: { secure_url?: string } }
          ) => {
            if (error) { setError("Upload fejlede"); return; }
            const secureUrl = result?.event === "success" ? result.info?.secure_url : null;
            if (secureUrl) setForm((f) => ({ ...f, logoUrl: secureUrl }));
          }
        );

        if (!createdWidget || typeof createdWidget.open !== "function") {
          setError("Upload-widget kunne ikke startes. Prøv at genindlæse siden.");
          return;
        }

        widgetRef.current = createdWidget;
      }

      const widget = widgetRef.current;
      if (!widget) {
        setError("Upload-widget kunne ikke startes. Prøv at genindlæse siden.");
        return;
      }

      widget.open();
    } catch {
      setError("Upload-widget fejlede uventet. Prøv igen eller genindlæs siden.");
    }
  }

  function startEdit(s: Sponsor) {
    setEditId(s.id);
    setForm({ name: s.name, logoUrl: s.logoUrl, websiteUrl: s.websiteUrl ?? "" });
    setError("");
  }

  function cancelEdit() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setError("");
  }

  async function handleSave() {
    if (!form.name || !form.logoUrl) { setError("Navn og logo er påkrævet"); return; }
    setSaving(true);
    setError("");
    try {
      if (editId) {
        const res = await fetch(`/api/admin/sponsors/${editId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, position: sponsors.find((s) => s.id === editId)?.position ?? 0 }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        const updated: Sponsor = await res.json();
        setSponsors((prev) => prev.map((s) => (s.id === editId ? updated : s)));
        cancelEdit();
      } else {
        const res = await fetch("/api/admin/sponsors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, position: sponsors.length }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        const created: Sponsor = await res.json();
        setSponsors((prev) => [...prev, created]);
        setForm(EMPTY_FORM);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fejl");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Slet sponsor?")) return;
    const res = await fetch(`/api/admin/sponsors/${id}`, { method: "DELETE" });
    if (!res.ok) { setError((await res.json()).error ?? "Kunne ikke slette"); return; }
    setSponsors((prev) => prev.filter((s) => s.id !== id));
    if (editId === id) cancelEdit();
  }

  async function move(id: string, dir: -1 | 1) {
    const idx = sponsors.findIndex((s) => s.id === id);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= sponsors.length) return;
    const reordered = [...sponsors];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    const updated = reordered.map((s, i) => ({ ...s, position: i }));
    setSponsors(updated);
    await Promise.all([
      fetch(`/api/admin/sponsors/${updated[idx].id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated[idx]),
      }),
      fetch(`/api/admin/sponsors/${updated[newIdx].id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated[newIdx]),
      }),
    ]);
  }

  async function saveHeading() {
    setHeadingSaving(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: [{ key: "sponsors_heading", value: heading }] }),
    });
    setHeadingSaving(false);
  }

  return (
    <div className="space-y-8">
      {/* Heading setting */}
      <div className="border rounded-xl p-5 space-y-3">
        <h2 className="font-semibold text-gray-700">Overskrift i footer</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={heading}
            onChange={(e) => setHeading(e.target.value)}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
            placeholder="Støt vores sponsorer"
          />
          <button
            onClick={saveHeading}
            disabled={headingSaving}
            className="bg-secondary text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {headingSaving ? "Gemmer…" : "Gem"}
          </button>
        </div>
      </div>

      {/* Sponsor list */}
      <div className="border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b text-left text-gray-500">
              <th className="px-4 py-2 font-medium">Logo</th>
              <th className="px-4 py-2 font-medium">Navn</th>
              <th className="px-4 py-2 font-medium">Hjemmeside</th>
              <th className="px-4 py-2 font-medium">Rækkefølge</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sponsors.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  Ingen sponsorer endnu
                </td>
              </tr>
            )}
            {sponsors.map((s, idx) => (
              <tr key={s.id}>
                <td className="px-4 py-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.logoUrl} alt={s.name} className="h-10 w-auto object-contain" />
                </td>
                <td className="px-4 py-2 font-medium">{s.name}</td>
                <td className="px-4 py-2 text-gray-500 truncate max-w-[160px]">
                  {s.websiteUrl || "–"}
                </td>
                <td className="px-4 py-2">
                  <div className="flex gap-1">
                    <button onClick={() => move(s.id, -1)} disabled={idx === 0}
                      className="px-1.5 py-0.5 text-xs border rounded disabled:opacity-30 hover:bg-gray-50">↑</button>
                    <button onClick={() => move(s.id, 1)} disabled={idx === sponsors.length - 1}
                      className="px-1.5 py-0.5 text-xs border rounded disabled:opacity-30 hover:bg-gray-50">↓</button>
                  </div>
                </td>
                <td className="px-4 py-2 text-right space-x-2">
                  <button onClick={() => startEdit(s)} className="text-xs text-blue-600 hover:underline">Rediger</button>
                  <button onClick={() => handleDelete(s.id)} className="text-xs text-red-500 hover:underline">Slet</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Form */}
      <div className="border rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-gray-700">{editId ? "Rediger sponsor" : "Tilføj sponsor"}</h2>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Navn</label>
            <input type="text" placeholder="Sponsornavn" value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Hjemmeside (valgfri)</label>
            <input type="url" placeholder="https://example.dk" value={form.websiteUrl}
              onChange={(e) => setForm((f) => ({ ...f, websiteUrl: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Logo</label>
          <div className="flex items-center gap-3">
            <button type="button" onClick={openCloudinaryWidget} disabled={!scriptReady}
              className="border border-gray-200 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50">
              {!scriptReady ? "Indlæser…" : form.logoUrl ? "Skift logo" : "Upload logo"}
            </button>
            {form.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.logoUrl} alt="Preview" className="h-10 w-auto object-contain" />
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving || !form.name || !form.logoUrl}
            className="bg-secondary text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
            {saving ? "Gemmer…" : editId ? "Gem ændringer" : "Tilføj sponsor"}
          </button>
          {editId && (
            <button onClick={cancelEdit}
              className="border border-gray-200 px-4 py-2 rounded-lg text-sm">
              Annuller
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
