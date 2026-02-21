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
              className="relative flex-[0_0_100%] min-w-0 min-h-[480px] md:min-h-[560px]"
            >
              {/* Background image */}
              {slide.imageUrl && (
                <Image
                  src={slide.imageUrl}
                  alt={slide.heading}
                  fill
                  className="object-cover object-center"
                  sizes="100vw"
                  priority
                />
              )}
              {/* Dark overlay — uses inline style so opacity is dynamic */}
              <div
                className="absolute inset-0 bg-secondary"
                style={{ opacity: slide.overlayOpacity / 100 }}
              />

              {/* Content */}
              <div className="relative max-w-6xl mx-auto px-4 py-20 md:py-32 h-full flex items-center">
                <div className="flex flex-col items-start gap-3 max-w-xl">
                  <h2 className="text-4xl md:text-6xl font-black uppercase leading-none tracking-tight">
                    {slide.heading}
                  </h2>
                  {slide.subheading && (
                    <p className="text-xl md:text-2xl font-light italic text-primary">
                      {slide.subheading}
                    </p>
                  )}
                  {slide.body && (
                    <p className="text-white/70 text-sm md:text-base mt-1 max-w-sm leading-relaxed line-clamp-3">
                      {slide.body}
                    </p>
                  )}
                  {slide.ctaLabel && slide.ctaHref && (
                    <Link
                      href={slide.ctaHref}
                      className="mt-3 flex items-center gap-2 bg-primary text-secondary font-black px-7 py-3 rounded-xl hover:bg-primary-dark transition text-sm tracking-wide"
                    >
                      {slide.ctaLabel} <ArrowRight size={16} />
                    </Link>
                  )}
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
            className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white rounded-full p-2 transition z-10"
            aria-label="Forrige slide"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            onClick={() => emblaApi?.scrollNext()}
            className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white rounded-full p-2 transition z-10"
            aria-label="Næste slide"
          >
            <ChevronRight size={22} />
          </button>

          {/* Dot indicators */}
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2 z-10">
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
