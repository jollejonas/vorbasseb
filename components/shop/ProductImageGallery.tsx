"use client";

import { useState } from "react";
import Image from "next/image";

type Props = {
  images: string[];
  name: string;
};

export function ProductImageGallery({ images, name }: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div className="aspect-square bg-surface rounded-2xl flex items-center justify-center text-gray-300 text-6xl font-bold">
        VBK
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Main image */}
      <div className="relative aspect-square bg-surface rounded-2xl overflow-hidden">
        <Image
          src={images[selectedIndex]}
          alt={`${name} ${selectedIndex + 1}`}
          fill
          className="object-contain transition-opacity duration-200"
          sizes="(max-width: 768px) 100vw, 50vw"
          priority={selectedIndex === 0}
        />
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setSelectedIndex(i)}
              className={`relative w-20 h-20 shrink-0 rounded-lg overflow-hidden border-2 transition ${
                i === selectedIndex
                  ? "border-secondary"
                  : "border-gray-200 hover:border-gray-400"
              }`}
              aria-label={`Vis billede ${i + 1}`}
            >
              <Image
                src={img}
                alt={`${name} miniature ${i + 1}`}
                fill
                className="object-cover"
                sizes="80px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
