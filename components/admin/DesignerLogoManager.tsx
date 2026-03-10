"use client";

import { useEffect, useRef, useState } from "react";

type Logo = {
  id: number;
  name: string;
  imageUrl: string;
  isClub: boolean;
};

type Props = { initialLogos: Logo[] };

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_UPLOAD_PRESET;

export function DesignerLogoManager({ initialLogos }: Props) {
  const [logos, setLogos] = useState<Logo[]>(initialLogos);
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isClub, setIsClub] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const widgetRef = useRef<any>(null);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://upload-widget.cloudinary.com/global/all.js";
    script.async = true;
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

  function openUpload() {
    if (!CLOUD_NAME || !UPLOAD_PRESET) {
      alert("Cloudinary er ikke konfigureret");
      return;
    }
    if (!widgetRef.current) {
      // @ts-expect-error cloudinary global
      widgetRef.current = window.cloudinary?.createUploadWidget(
        {
          cloudName: CLOUD_NAME,
          uploadPreset: UPLOAD_PRESET,
          multiple: false,
          resourceType: "image",
          folder: "vbk-designer-logos",
          clientAllowedFormats: ["jpg", "jpeg", "png", "webp", "svg"],
          maxFileSize: 2000000,
        },
        (error: unknown, result: { event: string; info: { secure_url: string } }) => {
          if (error) { alert("Upload fejlede"); return; }
          if (result.event === "success") {
            setImageUrl(result.info.secure_url);
          }
        }
      );
    }
    widgetRef.current?.open();
  }

  async function handleAdd() {
    if (!name || !imageUrl) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/designer-logos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, imageUrl, isClub }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const created: Logo = await res.json();
      setLogos((prev) => [...prev, created]);
      setName("");
      setImageUrl("");
      setIsClub(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fejl");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number, isClubLogo: boolean) {
    if (isClubLogo && !confirm("Dette er et klublogo. Slet alligevel?")) return;
    if (!isClubLogo && !confirm("Slet logo?")) return;
    const res = await fetch(`/api/admin/designer-logos/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setLogos((prev) => prev.filter((l) => l.id !== id));
  }

  return (
    <div className="space-y-8">
      {/* Logo list */}
      <div className="border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b text-left text-gray-500">
              <th className="px-4 py-2 font-medium">Logo</th>
              <th className="px-4 py-2 font-medium">Navn</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logos.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                  Ingen logoer endnu
                </td>
              </tr>
            )}
            {logos.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={l.imageUrl} alt={l.name} className="h-10 w-10 object-contain rounded" />
                </td>
                <td className="px-4 py-2 font-medium">{l.name}</td>
                <td className="px-4 py-2">
                  {l.isClub ? (
                    <span className="text-xs bg-secondary text-white px-2 py-0.5 rounded-full">Klublogo</span>
                  ) : (
                    <span className="text-xs text-gray-400">Sponsor</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => handleDelete(l.id, l.isClub)}
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

      {/* Add form */}
      <div className="border rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-gray-700">Tilføj logo</h2>
        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Navn</label>
            <input
              type="text"
              placeholder="Vorbasse BK"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Billede</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="https://res.cloudinary.com/…"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={openUpload}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 whitespace-nowrap"
              >
                Upload
              </button>
            </div>
          </div>
        </div>

        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="preview" className="h-16 object-contain rounded border border-gray-100 p-1" />
        )}

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={isClub}
            onChange={(e) => setIsClub(e.target.checked)}
            className="rounded"
          />
          Klublogo (markeres med badge)
        </label>

        <button
          onClick={handleAdd}
          disabled={saving || !name || !imageUrl}
          className="bg-secondary text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Gemmer…" : "Tilføj logo"}
        </button>
      </div>
    </div>
  );
}
