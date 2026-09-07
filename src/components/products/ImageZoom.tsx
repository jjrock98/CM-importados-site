'use client';
import { useRef, useState, useCallback } from 'react';
import { ZoomIn, X } from 'lucide-react';
import Image from 'next/image';

interface Props {
  /** URL pública de Supabase Storage — se usa TAL CUAL, sin pasar por el
   *  optimizador de next/image, para que la lupa muestre la resolución
   *  original del archivo subido (hasta 4K), no la versión recomprimida
   *  que se sirve en la miniatura de la grilla/carrusel. */
  src: string;
  alt: string;
}

/**
 * Lupa de imagen de producto.
 *
 * - Desktop (hover): al mover el mouse sobre la imagen aparece un panel
 *   con el recorte ampliado, generado con `background-image` apuntando
 *   directo al archivo original en Supabase Storage (bypass del
 *   optimizador de Next → resolución completa).
 * - Mobile/touch (tap): abre un visor a pantalla completa con la imagen
 *   original y pinch-to-zoom nativo del navegador (touch-action:
 *   pinch-zoom sobre un contenedor con overflow), sin librerías externas.
 */
export function ImageZoom({ src, alt }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hovering, setHovering] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [bgPos, setBgPos] = useState('50% 50%');

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setBgPos(`${x}% ${y}%`);
  }, []);

  return (
    <>
      {/* ── Vista base (desktop: hover-magnifier / mobile: tap para abrir) ── */}
      <div
        ref={containerRef}
        className="group/zoom relative h-full w-full cursor-zoom-in"
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onMouseMove={handleMouseMove}
        onClick={() => setLightboxOpen(true)}
      >
        <Image
          src={src}
          alt={alt}
          fill
          priority
          className="object-cover transition-transform duration-500 group-hover/zoom:scale-105"
          sizes="(max-width: 1024px) 100vw, 50vw"
        />

        {/* Indicador de lupa disponible */}
        <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover/zoom:opacity-100">
          <ZoomIn size={12} />
          <span className="hidden sm:inline">Ver en detalle</span>
        </div>

        {/* Panel de zoom — solo desktop (se apoya en hover, que no existe en touch) */}
        {hovering && (
          <div
            className="pointer-events-none absolute inset-0 z-20 hidden rounded-2xl border border-border bg-surface shadow-xl md:block"
            style={{
              // Se posiciona al costado de la imagen en pantallas grandes.
              left: 'calc(100% + 1rem)',
              top: 0,
              width: '100%',
              height: '100%',
              backgroundImage: `url(${src})`,
              backgroundRepeat: 'no-repeat',
              backgroundSize: '250%', // nivel de ampliación
              backgroundPosition: bgPos,
            }}
          />
        )}
      </div>

      {/* ── Lightbox fullscreen con pinch-zoom nativo (mobile y desktop) ── */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Cerrar"
          >
            <X size={22} />
          </button>

          {/* Contenedor con scroll + touch-action: pinch-zoom → el usuario
              pellizca para ampliar con el gesto nativo del navegador,
              siempre sobre el archivo original (misma URL, sin optimizar). */}
          <div
            className="h-full w-full overflow-auto"
            style={{ touchAction: 'pinch-zoom' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex min-h-full items-center justify-center p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={alt}
                className="max-w-none select-none"
                style={{ width: 'auto', height: 'auto', maxHeight: 'none' }}
                draggable={false}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}