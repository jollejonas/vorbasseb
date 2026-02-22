"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

type FaqItem = { question: string; answer: string };

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="divide-y divide-gray-100 border border-gray-100 rounded-2xl overflow-hidden">
      {items.map((item, i) => (
        <div key={i}>
          <button
            type="button"
            className="w-full flex items-center justify-between px-6 py-4 text-left text-sm font-medium hover:bg-gray-50 transition"
            onClick={() => setOpen(open === i ? null : i)}
            aria-expanded={open === i}
          >
            <span>{item.question}</span>
            <ChevronDown
              size={18}
              className={`shrink-0 text-secondary transition-transform ${open === i ? "rotate-180" : ""}`}
            />
          </button>
          {open === i && (
            <div className="px-6 pb-4 text-sm text-gray-600 leading-relaxed">
              {item.answer}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
