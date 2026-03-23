"use client";

type Sponsor = { id: string; name: string; logoUrl: string; websiteUrl: string | null };

function SponsorLogo({ s }: { s: Sponsor }) {
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={s.logoUrl}
      alt={s.name}
      className="h-12 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity"
    />
  );
  return s.websiteUrl ? (
    <a href={s.websiteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center">
      {img}
    </a>
  ) : (
    <span className="inline-flex items-center">{img}</span>
  );
}

export function SponsorCarousel({ sponsors }: { sponsors: Sponsor[] }) {
  if (sponsors.length === 0) return null;

  // < 3 sponsors: static centered row, no carousel
  if (sponsors.length < 3) {
    return (
      <div className="flex justify-center items-center gap-12 flex-wrap py-2">
        {sponsors.map((s) => (
          <SponsorLogo key={s.id} s={s} />
        ))}
      </div>
    );
  }

  // >= 3 sponsors: 4 copies so the track is always wider than any viewport.
  // Animating -25% = exactly one set's width, keeping the loop seamless.
  const items = [...sponsors, ...sponsors, ...sponsors, ...sponsors];

  return (
    <>
      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-25%); }
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
          {items.map((s, i) => (
            <span key={i} className="mx-8">
              <SponsorLogo s={s} />
            </span>
          ))}
        </div>
      </div>
    </>
  );
}
