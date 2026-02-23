import { X } from "lucide-react";

type Category = { name: string; slug: string };

export type FilterSearchParams = {
  kategori?: string;
  size?: string;
  sort?: string;
  tilgaengelig?: string;
  q?: string;
};

type FilterContentProps = {
  categories: Category[];
  sizeOptions: string[];
  searchParams: FilterSearchParams;
};

function buildHref(
  current: FilterSearchParams,
  overrides: Record<string, string | undefined>
): string {
  const params = new URLSearchParams();
  const merged = { ...current, ...overrides };
  for (const [k, v] of Object.entries(merged)) {
    if (v) params.set(k, v);
  }
  const str = params.toString();
  return `/butik${str ? `?${str}` : ""}`;
}

export function FilterContent({
  categories,
  sizeOptions,
  searchParams,
}: FilterContentProps) {
  const { kategori, size, sort, tilgaengelig } = searchParams;

  const pillBase =
    "block w-full text-left px-3 py-1.5 rounded-lg text-sm font-medium border transition";
  const pillActive = "bg-secondary text-white border-secondary";
  const pillInactive =
    "bg-white text-gray-700 border-gray-200 hover:border-secondary";

  return (
    <div className="space-y-6 text-sm">
      {/* Kategorier */}
      <div>
        <p className="font-semibold text-gray-800 mb-2 uppercase tracking-wider text-xs">
          Kategori
        </p>
        <div className="space-y-1">
          <a
            href={buildHref(searchParams, { kategori: undefined })}
            className={`${pillBase} ${!kategori ? pillActive : pillInactive}`}
          >
            Alle produkter
          </a>
          {categories.map((c) => (
            <a
              key={c.slug}
              href={buildHref(searchParams, { kategori: c.slug })}
              className={`${pillBase} ${kategori === c.slug ? pillActive : pillInactive}`}
            >
              {c.name}
            </a>
          ))}
        </div>
      </div>

      {/* Størrelser */}
      {sizeOptions.length > 0 && (
        <div>
          <p className="font-semibold text-gray-800 mb-2 uppercase tracking-wider text-xs">
            Størrelse
          </p>
          <div className="flex flex-wrap gap-1.5">
            {sizeOptions.map((s) => (
              <a
                key={s}
                href={buildHref(searchParams, {
                  size: size === s ? undefined : s,
                })}
                className={`px-2.5 py-1 rounded border text-xs font-medium transition ${
                  size === s ? pillActive : pillInactive
                }`}
              >
                {s}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Tilgængelighed */}
      <div>
        <p className="font-semibold text-gray-800 mb-2 uppercase tracking-wider text-xs">
          Tilgængelighed
        </p>
        <a
          href={buildHref(searchParams, {
            tilgaengelig: tilgaengelig === "1" ? undefined : "1",
          })}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border transition text-sm ${
            tilgaengelig === "1" ? pillActive : pillInactive
          }`}
        >
          <span
            className={`w-4 h-4 rounded border flex items-center justify-center text-xs flex-shrink-0 ${
              tilgaengelig === "1"
                ? "bg-white border-white text-secondary font-bold"
                : "border-gray-400"
            }`}
          >
            {tilgaengelig === "1" && <X size={10} strokeWidth={3} />}
          </span>
          Kun tilgængelige
        </a>
      </div>

      {/* Sortering */}
      <div>
        <p className="font-semibold text-gray-800 mb-2 uppercase tracking-wider text-xs">
          Sortering
        </p>
        <div className="space-y-1">
          {[
            { label: "Nyeste", value: "" },
            { label: "Pris: lav → høj", value: "price_asc" },
            { label: "Pris: høj → lav", value: "price_desc" },
          ].map((s) => (
            <a
              key={s.value}
              href={buildHref(searchParams, { sort: s.value || undefined })}
              className={`${pillBase} ${
                (sort ?? "") === s.value ? pillActive : pillInactive
              }`}
            >
              {s.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
