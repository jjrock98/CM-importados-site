'use client';
import { useRef, useState, useCallback, useEffect } from 'react';
import { ZoomIn, X, Plus, Minus } from 'lucide-react';
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
 * - Mobile/touch (tap): abre un visor a pantalla completa. Arranca SIEMPRE
 *   con la imagen completa visible (object-contain) — nunca renderizada a
 *   tamaño nativo con `overflow` centrado, que es lo que dejaba la pantalla
 *   en negro (la imagen quedaba fuera del área visible del scroll porque
 *   el centrado flex reparte el desborde para los dos lados por igual y
 *   el scroll no puede ir a valores negativos). El acercamiento real se
 *   hace con pinch nativo del navegador o con los botones +/-, y al
 *   ampliar se ancla el contenido arriba-a-la-izquierda para que siempre
 *   quede dentro del área con scroll.
 */
export function ImageZoom({ src, alt }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hovering, setHovering] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [bgPos, setBgPos] = useState('50% 50%');

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setBgPos(`${x}% ${y}%`);
  }, []);

  // Al abrir el visor, siempre arranca mostrando la imagen completa.
  useEffect(() => {
    if (lightboxOpen) setZoomed(false);
  }, [lightboxOpen]);

  // Click sobre la imagen: alterna entre "completa" y "tamaño real",
  // centrando el scroll en el punto donde tocó/clickeó.
  const handleImageClick = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    e.stopPropagation();
    const imgEl = e.currentTarget;
    const scrollEl = scrollRef.current;

    if (!zoomed) {
      const rect = imgEl.getBoundingClientRect();
      const ratioX = (e.clientX - rect.left) / rect.width;
      const ratioY = (e.clientY - rect.top) / rect.height;
      setZoomed(true);
      requestAnimationFrame(() => {
        const el = scrollRef.current;
        if (!el) return;
        el.scrollLeft = el.scrollWidth * ratioX - el.clientWidth / 2;
        el.scrollTop  = el.scrollHeight * ratioY - el.clientHeight / 2;
      });
    } else {
      setZoomed(false);
      if (scrollEl) { scrollEl.scrollLeft = 0; scrollEl.scrollTop = 0; }
    }
  }, [zoomed]);

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

      {/* ── Lightbox fullscreen ── */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-[100] flex flex-col bg-black/95"
          onClick={() => setLightboxOpen(false)}
        >
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-xs text-white/70">
              {zoomed ? 'Tocá de nuevo para ver completa' : 'Tocá o pellizcá para ampliar'}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setZoomed((z) => !z);
                  if (scrollRef.current) { scrollRef.current.scrollLeft = 0; scrollRef.current.scrollTop = 0; }
                }}
                className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                aria-label={zoomed ? 'Alejar' : 'Acercar'}
              >
                {zoomed ? <Minus size={18} /> : <Plus size={18} />}
              </button>
              <button
                onClick={() => setLightboxOpen(false)}
                className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                aria-label="Cerrar"
              >
                <X size={22} />
              </button>
            </div>
          </div>

          {/* Contenedor con scroll. En modo "completa" la imagen usa
              object-contain (siempre visible, sin trampa de overflow
              centrado). En modo "zoomed" se muestra a tamaño nativo
              anclada arriba-a-la-izquierda, así el scroll (0,0) siempre
              cae dentro de la imagen — nunca queda todo en negro. El
              touch-action: pinch-zoom deja además pellizcar con los dedos
              en cualquiera de los dos modos. */}
          <div
            ref={scrollRef}
            className={zoomed ? 'flex-1 overflow-auto' : 'flex flex-1 items-center justify-center overflow-hidden p-4'}
            style={{ touchAction: 'pinch-zoom' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              onClick={handleImageClick}
              className={zoomed ? 'max-w-none cursor-zoom-out select-none' : 'max-h-full max-w-full cursor-zoom-in select-none object-contain'}
              draggable={false}
            />
          </div>
        </div>
      )}
    </>
  );
}