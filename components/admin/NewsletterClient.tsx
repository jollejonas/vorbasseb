"use client";

import { useState } from "react";
import { toast } from "sonner";
import { TipTapEditor } from "./TipTapEditor";

export function NewsletterClient({ subscriberCount }: { subscriberCount: number }) {
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(false);

  async function handleSend() {
    if (!subject.trim()) {
      toast.error("Skriv et emne");
      return;
    }
    if (!html || html === "<p></p>") {
      toast.error("Skriv noget indhold");
      return;
    }
    if (!confirm(`Send nyhedsbrev til ${subscriberCount} abonnenter?`)) return;

    setSending(true);
    try {
      const res = await fetch("/api/newsletter/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, html }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ukendt fejl");
      toast.success(`Nyhedsbrev sendt til ${data.sent} abonnenter`);
      setSubject("");
      setHtml("");
      setCooldown(true);
      setTimeout(() => setCooldown(false), 30_000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Noget gik galt");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium mb-1">Emne</label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Nyhedsbrev fra VBK Shoppen"
          className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Indhold</label>
        <TipTapEditor content={html} onChange={setHtml} placeholder="Skriv dit nyhedsbrev her..." />
      </div>

      <button
        onClick={handleSend}
        disabled={sending || cooldown || subscriberCount === 0}
        className="bg-secondary text-white font-bold px-6 py-3 rounded-xl hover:bg-secondary-dark transition disabled:opacity-60"
      >
        {sending
          ? "Sender…"
          : cooldown
            ? "Sendt — vent 30 sek."
            : `Send til ${subscriberCount} abonnenter`}
      </button>
    </div>
  );
}
