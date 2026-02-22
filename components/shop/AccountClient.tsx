"use client";

import { useState } from "react";
import { toast } from "sonner";

type Props = {
  name: string | null;
  email: string;
  newsletterConsent: boolean;
};

export function AccountClient({ name: initialName, email, newsletterConsent: initialConsent }: Props) {
  const [name, setName] = useState(initialName ?? "");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [newsletterConsent, setNewsletterConsent] = useState(initialConsent);
  const [savingNewsletter, setSavingNewsletter] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Ukendt fejl");
      }
      toast.success("Navn opdateret");
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Noget gik galt");
    } finally {
      setSaving(false);
    }
  }

  async function handleNewsletterToggle() {
    setSavingNewsletter(true);
    const newVal = !newsletterConsent;
    try {
      const res = await fetch("/api/account/newsletter-consent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newsletterConsent: newVal }),
      });
      if (!res.ok) throw new Error();
      setNewsletterConsent(newVal);
      toast.success(newVal ? "Tilmeldt nyhedsbrev" : "Afmeldt nyhedsbrev");
    } catch {
      toast.error("Noget gik galt");
    } finally {
      setSavingNewsletter(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">
          E-mail
        </p>
        <p className="text-sm text-gray-800">{email}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          Din e-mailadresse kan ikke ændres.
        </p>
      </div>

      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">
          Navn
        </p>
        {editing ? (
          <form onSubmit={handleSave} className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary flex-1 max-w-xs"
              placeholder="Dit navn"
              autoFocus
            />
            <button
              type="submit"
              disabled={saving}
              className="bg-secondary text-white text-xs font-semibold px-4 py-1.5 rounded-lg hover:bg-secondary-dark transition disabled:opacity-50"
            >
              {saving ? "Gemmer..." : "Gem"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-xs text-gray-500 hover:text-gray-700 px-2"
            >
              Annuller
            </button>
          </form>
        ) : (
          <div className="flex items-center gap-3">
            <p className="text-sm text-gray-800">{name || <em className="text-gray-400">Intet navn angivet</em>}</p>
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-secondary underline hover:text-secondary-dark"
            >
              Skift
            </button>
          </div>
        )}
      </div>

      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">
          Nyhedsbrev
        </p>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={newsletterConsent}
            onChange={handleNewsletterToggle}
            disabled={savingNewsletter}
            className="accent-secondary w-4 h-4"
          />
          <span className="text-sm text-gray-700">
            {newsletterConsent
              ? "Du modtager nyhedsbreve fra VBK Shoppen"
              : "Modtag nyhedsbreve fra VBK Shoppen"}
          </span>
        </label>
      </div>
    </div>
  );
}
