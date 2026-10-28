"use client";

import { useState } from "react";
import Image from "next/image";

type Props = {
  images: string[];
  name: string;
};

export function ProductImageGallery({ images, name }: Props) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const selectedIndex = Math.max(0, images.indexOf(selectedImage ?? ""));

  if (images.length === 0) {
    return (
      <div className="aspect-square bg-surface rounded-2xl flex items-center justify-center text-gray-300 text-6xl font-bold">
        VBK
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4">
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
        <div className="flex gap-3 overflow-x-auto p-1" aria-label="Produktbilleder">
          {images.map((img, i) => (
            <button
              key={`${img}-${i}`}
              type="button"
              onClick={() => setSelectedImage(img)}
              className={`relative w-32 h-32 sm:w-40 sm:h-40 shrink-0 rounded-xl bg-white overflow-hidden border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 ${
                i === selectedIndex
                  ? "border-secondary"
                  : "border-gray-200 hover:border-gray-400"
              }`}
              aria-label={`Vis billede ${i + 1}`}
              aria-pressed={i === selectedIndex}
            >
              <Image
                src={img}
                alt={`${name} miniature ${i + 1}`}
                fill
                className="object-contain"
                sizes="(max-width: 639px) 128px, 160px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
