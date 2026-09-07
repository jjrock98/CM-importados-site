'use client';
import { useEffect } from 'react';
import { pixelViewContent } from '@/lib/fbpixel';
import { useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Package } from 'lucide-react';
import { cn } from '@/utils';
import { ImageZoom } from './ImageZoom';

interface Props {
  images: string[];
  nombre: string;
}

export function ProductPageClient({ images, nombre }: Props) {
  const [current, setCurrent] = useState(0);

  const prev = () => setCurrent((c) => (c - 1 + images.length) % images.length);
  const next = () => setCurrent((c) => (c + 1) % images.length);

  if (images.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-2xl bg-surface-2">
        <Package size={64} className="text-muted opacity-30" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Main image — con lupa: hover-magnifier en desktop, tap para
          pantalla completa con pinch-zoom en mobile. Siempre sobre el
          archivo original, sin recomprimir. */}
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-surface-2 group">
        <ImageZoom src={images[current]} alt={`${nombre} - imagen ${current + 1}`} />

        {images.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 dark:bg-black/60 p-2 shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110"
              aria-label="Imagen anterior"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={next}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 dark:bg-black/60 p-2 shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110"
              aria-label="Siguiente imagen"
            >
              <ChevronRight size={18} />
            </button>

            {/* Dots */}
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={cn(
                    'h-1.5 rounded-full transition-all',
                    i === current ? 'w-5 bg-white' : 'w-1.5 bg-white/50'
                  )}
                  aria-label={`Ir a imagen ${i + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={cn(
                'relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition-all',
                i === current
                  ? 'border-brand-500 opacity-100'
                  : 'border-transparent opacity-50 hover:opacity-80'
              )}
            >
              <Image src={img} alt={`${nombre} ${i + 1}`} fill className="object-cover" sizes="64px" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}