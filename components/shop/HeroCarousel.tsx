"use client";

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Star, ArrowRight } from "lucide-react";
import type { ResolvedSlide } from "@/lib/hero";

type Props = { slides: ResolvedSlide[] };

function StaticHeroFallback() {
  return (
    <section className="relative bg-secondary text-white overflow-hidden">
      <div className="relative max-w-6xl mx-auto px-4 py-24 md:py-36">
        <div className="flex flex-col items-start gap-2 max-w-xl">
          <h1 className="text-5xl md:text-7xl font-black uppercase leading-none tracking-tight">
            Vorbasse<br />Boldklub
          </h1>
          <p className="text-2xl md:text-3xl font-light italic text-primary">Officiel butik</p>
          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <Link
              href="/butik"
              className="flex items-center gap-2 bg-primary text-secondary font-black px-8 py-3 rounded-xl hover:bg-primary-dark transition text-sm tracking-wide"
            >
              Se butikken <ArrowRight size={16} />
            </Link>
            <Link
              href="/fanklub"
              className="flex items-center gap-2 bg-white/10 text-white font-semibold px-8 py-3 rounded-xl hover:bg-white/20 transition border border-white/20 text-sm"
            >
              <Star size={16} className="text-primary" /> Bliv fanklubsmedlem
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export function HeroCarousel({ slides }: Props) {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true },
    [Autoplay({ delay: 5000, stopOnMouseEnter: true, stopOnInteraction: false })]
  );
  const [selectedIndex, setSelectedIndex] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onSelect);
    onSelect();
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi, onSelect]);

  if (slides.length === 0) return <StaticHeroFallback />;

  return (
    <section className="relative bg-secondary text-white overflow-hidden">
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex">
          {slides.map((slide) => (
            <div
              key={slide.id}
              className="relative flex-[0_0_100%] min-w-0 bg-[#0a0f1e] text-white flex flex-col md:block md:h-[420px]"
            >
              {/* Mobile: image strip at top */}
              {slide.imageUrl && (
                <div className="relative h-[170px] shrink-0 md:hidden">
                  <Image
                    src={slide.imageUrl}
                    alt={slide.heading}
                    fill
                    className="object-cover object-center"
                    sizes="100vw"
                    priority
                  />
                </div>
              )}

              {/* Desktop: image in right 60%, mask fades it into the dark bg on both sides */}
              {slide.imageUrl && (
                <div
                  className="absolute top-0 right-0 h-full w-[60%] hidden md:block"
                  style={{
                    WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 22%, black 78%, transparent 100%)",
                    maskImage: "linear-gradient(to right, transparent 0%, black 22%, black 78%, transparent 100%)",
                  }}
                >
                  <Image
                    src={slide.imageUrl}
                    alt={slide.heading}
                    fill
                    className="object-contain object-right object-top"
                    sizes="60vw"
                    priority
                  />
                </div>
              )}

              {/* Content: flex-1 on mobile, vertically centered on desktop */}
              <div className="flex-1 md:absolute md:inset-0 md:flex md:items-center relative px-5 py-6 md:py-0 md:px-0">
                <div className="md:max-w-6xl md:mx-auto md:w-full md:px-8">
                  <div className="max-w-sm flex flex-col items-start gap-2">
                    {slide.subheading && (
                      <p className="text-primary text-xs font-bold uppercase tracking-widest">
                        {slide.subheading}
                      </p>
                    )}
                    <h2 className="text-2xl md:text-4xl font-black uppercase leading-tight tracking-tight line-clamp-2">
                      {slide.heading}
                    </h2>
                    {slide.body && (
                      <p className="text-white/80 text-sm leading-relaxed line-clamp-2">
                        {slide.body}
                      </p>
                    )}
                    {slide.ctaLabel && slide.ctaHref && (
                      <Link
                        href={slide.ctaHref}
                        className="mt-1 inline-flex items-center gap-2 bg-primary text-secondary font-black px-6 py-2.5 rounded-xl hover:bg-primary-dark transition text-sm tracking-wide"
                      >
                        {slide.ctaLabel} <ArrowRight size={16} />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Prev / Next arrows (only shown if more than 1 slide) */}
      {slides.length > 1 && (
        <>
          <button
            onClick={() => emblaApi?.scrollPrev()}
            className="hidden md:block absolute left-3 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white rounded-full p-2 transition z-10"
            aria-label="Forrige slide"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            onClick={() => emblaApi?.scrollNext()}
            className="hidden md:block absolute right-3 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white rounded-full p-2 transition z-10"
            aria-label="Næste slide"
          >
            <ChevronRight size={22} />
          </button>

          {/* Dot indicators */}
          <div className="hidden md:flex absolute bottom-5 left-1/2 -translate-x-1/2 gap-2 z-10">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => emblaApi?.scrollTo(i)}
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  i === selectedIndex ? "bg-primary scale-125" : "bg-white/40 hover:bg-white/70"
                }`}
                aria-label={`Gå til slide ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
