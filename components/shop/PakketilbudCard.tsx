import Link from "next/link";
import { formatPrice, withVat } from "@/lib/utils";

type Props = {
  pakketilbud: {
    id: string;
    name: string;
    slug: string;
    price: number;
    images: string[];
    items: { id: string; label: string | null; product: { name: string } }[];
  };
  vatPct: number;
  isSoldOut?: boolean;
};

export function PakketilbudCard({ pakketilbud, vatPct, isSoldOut = false }: Props) {
  return (
    <Link
      href={`/pakketilbud/${pakketilbud.slug}`}
      className={`group block bg-white rounded-2xl border transition overflow-hidden ${
        isSoldOut ? "opacity-60 cursor-default pointer-events-none" : "hover:shadow-md"
      }`}
      aria-disabled={isSoldOut}
      tabIndex={isSoldOut ? -1 : undefined}
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-gray-100">
        {pakketilbud.images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pakketilbud.images[0]}
            alt={pakketilbud.name}
            className={`w-full h-full object-cover transition duration-300 ${
              isSoldOut ? "grayscale" : "group-hover:scale-105"
            }`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-sm">
            Intet billede
          </div>
        )}
        {isSoldOut ? (
          <span className="absolute top-2 left-2 bg-gray-700 text-white text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
            Udsolgt
          </span>
        ) : (
          <span className="absolute top-2 left-2 bg-secondary text-white text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
            Pakke
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-bold text-gray-900 mb-1 truncate">{pakketilbud.name}</h3>
        <p className="text-xs text-gray-500 mb-2 truncate">
          {pakketilbud.items.map((it) => it.label ?? it.product.name).join(" + ")}
        </p>
        <div className="flex items-center justify-between">
          <span className={`font-bold ${isSoldOut ? "text-gray-400" : "text-secondary"}`}>
            {formatPrice(withVat(pakketilbud.price, vatPct))}
          </span>
          {isSoldOut ? (
            <span className="text-xs text-gray-400">Midlertidigt udsolgt</span>
          ) : (
            <span className="text-xs text-gray-400">Se pakke →</span>
          )}
        </div>
      </div>
    </Link>
  );
}
