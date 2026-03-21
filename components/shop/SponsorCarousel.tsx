"use client";

type Sponsor = { id: string; name: string; logoUrl: string; websiteUrl: string | null };

export function SponsorCarousel({ sponsors }: { sponsors: Sponsor[] }) {
  if (sponsors.length === 0) return null;

  // Duplicate the list to create a seamless loop
  const items = [...sponsors, ...sponsors];

  return (
    <>
      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .sponsor-track {
          animation: marquee 25s linear infinite;
        }
        .sponsor-track:hover {
          animation-play-state: paused;
        }
      `}</style>
      <div className="overflow-hidden">
        <div className="flex sponsor-track whitespace-nowrap">
          {items.map((s, i) => {
            const inner = (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={s.logoUrl}
                alt={s.name}
                className="h-12 w-auto object-contain mx-8 opacity-80 hover:opacity-100 transition-opacity"
              />
            );
            return s.websiteUrl ? (
              <a key={i} href={s.websiteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center">
                {inner}
              </a>
            ) : (
              <span key={i} className="inline-flex items-center">{inner}</span>
            );
          })}
        </div>
      </div>
    </>
  );
}
