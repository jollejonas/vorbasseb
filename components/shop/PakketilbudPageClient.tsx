"use client";

import { useState, useEffect } from "react";
import { formatPrice, withVat } from "@/lib/utils";
import { PakketilbudWizard } from "./PakketilbudWizard";

type Item = {
  id: string;
  label: string | null;
  product: { name: string };
};

type PakketilbudData = Parameters<typeof PakketilbudWizard>[0]["pakketilbud"];

type Props = {
  pakketilbud: PakketilbudData & {
    images: string[];
    description: string;
    price: number;
    items: Item[];
  };
  vatPct: number;
  isSoldOut: boolean;
  soldOutItems: string[];
};

function WizardView({
  pakketilbud,
  vatPct,
  isSoldOut,
  soldOutItems,
  onBack,
}: Props & { onBack: () => void }) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="text-sm text-gray-500 hover:text-secondary mb-6 inline-flex items-center gap-1"
      >
        ← Tilbage til pakken
      </button>

      {isSoldOut && (
        <div className="mb-6 rounded-xl border border-orange-200 bg-orange-50 px-5 py-4 text-sm text-orange-800">
          <strong>Midlertidigt udsolgt:</strong>{" "}
          {soldOutItems.join(", ")} er i øjeblikket udsolgt og pakken kan derfor ikke bestilles.
        </div>
      )}

      <PakketilbudWizard pakketilbud={pakketilbud} vatPct={vatPct} isSoldOut={isSoldOut} />
    </div>
  );
}

export function PakketilbudPageClient({ pakketilbud, vatPct, isSoldOut, soldOutItems }: Props) {
  const [started, setStarted] = useState(false);

  if (started) {
    return (
      <WizardView
        pakketilbud={pakketilbud}
        vatPct={vatPct}
        isSoldOut={isSoldOut}
        soldOutItems={soldOutItems}
        onBack={() => setStarted(false)}
      />
    );
  }

  return (
    <div className="grid md:grid-cols-2 gap-8">
      {/* Image gallery */}
      <div>
        {pakketilbud.images.length > 0 ? (
          <div className="space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pakketilbud.images[0]}
              alt={pakketilbud.name}
              className="w-full aspect-square object-cover rounded-2xl"
            />
            {pakketilbud.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {pakketilbud.images.slice(1).map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={url}
                    alt=""
                    className="w-20 h-20 object-cover rounded-lg shrink-0"
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="w-full aspect-square bg-gray-100 rounded-2xl flex items-center justify-center text-gray-300">
            Intet billede
          </div>
        )}
      </div>

      {/* Details + CTA */}
      <div className="space-y-4">
        <div>
          <span className="inline-block bg-secondary/10 text-secondary text-xs font-semibold px-3 py-1 rounded-full mb-3 uppercase tracking-wide">
            Pakketilbud
          </span>
          <h1 className="text-3xl font-black mb-2">{pakketilbud.name}</h1>
          <p className="text-2xl font-bold text-secondary">
            {formatPrice(withVat(pakketilbud.price, vatPct))}
            <span className="text-sm text-gray-400 font-normal ml-1">inkl. moms</span>
          </p>
        </div>

        {pakketilbud.description && (
          <p className="text-gray-600 leading-relaxed">{pakketilbud.description}</p>
        )}

        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Indeholder:</p>
          <ul className="space-y-1">
            {pakketilbud.items.map((item) => (
              <li key={item.id} className="flex items-center gap-2 text-sm text-gray-600">
                <span className="w-1.5 h-1.5 bg-secondary rounded-full shrink-0" />
                {item.label ?? item.product.name}
              </li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          onClick={() => !isSoldOut && setStarted(true)}
          disabled={isSoldOut}
          className="w-full bg-primary text-secondary font-bold py-3 px-6 rounded-xl hover:bg-primary-dark transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSoldOut ? "Midlertidigt udsolgt" : "Sammensæt din pakke →"}
        </button>
      </div>
    </div>
  );
}
