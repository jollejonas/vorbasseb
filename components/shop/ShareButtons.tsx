"use client";

import { useState } from "react";
import { Facebook, Link as LinkIcon } from "lucide-react";

export function ShareButtons({ slug, title }: { slug: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const url = `https://vbkshoppen.dk/nyheder/${slug}`;

  function shareOnFacebook() {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      "_blank",
      "width=600,height=400"
    );
  }

  async function copyLink() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-3 mt-8 pt-6 border-t border-gray-200">
      <span className="text-sm text-gray-500 font-medium">Del:</span>
      <button
        onClick={shareOnFacebook}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1877F2] text-white text-xs font-semibold hover:bg-[#166fe5] transition"
      >
        <Facebook size={14} /> Facebook
      </button>
      <button
        onClick={copyLink}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 text-xs font-semibold hover:border-gray-400 transition"
      >
        <LinkIcon size={14} /> {copied ? "Kopieret!" : "Kopiér link"}
      </button>
    </div>
  );
}
