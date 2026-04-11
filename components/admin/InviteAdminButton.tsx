"use client";

import { useState } from "react";
import { toast } from "sonner";
import { UserPlus, X } from "lucide-react";

export function InviteAdminButton() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await fetch("/api/admin/users/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();

    if (!res.ok) {
      toast.error(data.error ?? "Noget gik galt");
      setLoading(false);
      return;
    }

    toast.success(`Invitation sendt til ${email}`);
    setEmail("");
    setOpen(false);
    setLoading(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-secondary text-white px-4 py-2 rounded-lg text-sm hover:bg-secondary-dark transition"
      >
        <UserPlus size={15} />
        Inviter admin
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Inviter ny admin</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition"
                aria-label="Luk"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-1">E-mailadresse</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@eksempel.dk"
                  className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
                />
              </div>

              <p className="text-sm text-gray-500">
                Personen modtager en e-mail med et link til at oprette deres admin-konto. Linket er gyldigt i 48 timer.
              </p>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 border border-gray-200 rounded-xl py-3 text-sm hover:bg-gray-50 transition"
                >
                  Annuller
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-secondary text-white font-bold py-3 rounded-xl hover:bg-secondary-dark transition disabled:opacity-60"
                >
                  {loading ? "Sender…" : "Send invitation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
