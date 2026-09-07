'use client';
import { useRef, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
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

const PANEL_GAP = 16; // separación entre la imagen y el panel ampliado (px)

/**
 * Lupa de imagen de producto.
 *
 * - Desktop (hover): al mover el mouse sobre la imagen aparece un panel
 *   con el recorte ampliado, generado con `background-image` apuntando
 *   directo al archivo original en Supabase Storage (bypass del
 *   optimizador de Next → resolución completa).
 *
 *   El panel se monta con un PORTAL a `document.body` y se posiciona con
 *   `position: fixed` calculado a partir del `getBoundingClientRect()` del
 *   contenedor. Antes se posicionaba `absolute` dentro del propio
 *   contenedor con `left: calc(100% + 1rem)`, lo que lo dejaba SIEMPRE
 *   invisible apenas el contenedor (o cualquier ancestro) tuviera
 *   `overflow-hidden` — como pasa en la galería de producto y en el modal
 *   de vista rápida. El portal + fixed lo saca de ese problema por
 *   completo. Además, ahora elige de qué lado aparece (derecha, izquierda,
 *   o superpuesto si no entra en ningún lado) según el espacio real
 *   disponible en el viewport, para no cortarse contra el borde de la
 *   pantalla ni quedar tapado por otra columna del layout.
 *
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
  const [mounted, setMounted] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [bgPos, setBgPos] = useState('50% 50%');
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});

  // El portal necesita `document`, que no existe en el render de servidor.
  useEffect(() => setMounted(true), []);

  const positionPanel = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const fitsRight = rect.right + PANEL_GAP + rect.width <= vw;
    const fitsLeft  = rect.left - PANEL_GAP - rect.width >= 0;

    let left: number;
    if (fitsRight) {
      left = rect.right + PANEL_GAP;
    } else if (fitsLeft) {
      left = rect.left - PANEL_GAP - rect.width;
    } else {
      // No hay lugar de ningún lado (pantallas angostas/medianas con poco
      // margen, ej. el modal de vista rápida): se superpone a la imagen
      // en vez de quedar invisible. Como solo aparece en hover y tiene
      // sombra propia, se lee como un panel flotante temporal.
      left = Math.max(0, Math.min(rect.left, vw - rect.width));
    }

    // Nunca se sale por arriba/abajo del viewport.
    const top = Math.max(0, Math.min(rect.top, vh - rect.height));

    setPanelStyle({ left, top, width: rect.width, height: rect.height });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setBgPos(`${x}% ${y}%`);
  }, []);

  const handleMouseEnter = useCallback(() => {
    positionPanel();
    setHovering(true);
  }, [positionPanel]);

  // Si la ventana cambia de tamaño o hace scroll mientras se está mostrando
  // el panel, se recalcula la posición (el portal ya no se mueve solo con
  // el layout porque es `fixed` respecto al viewport, no al contenedor).
  useEffect(() => {
    if (!hovering) return;
    window.addEventListener('scroll', positionPanel, true);
    window.addEventListener('resize', positionPanel);
    return () => {
      window.removeEventListener('scroll', positionPanel, true);
      window.removeEventListener('resize', positionPanel);
    };
  }, [hovering, positionPanel]);

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
        onMouseEnter={handleMouseEnter}
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
      </div>

      {/* Panel de zoom — solo desktop (se apoya en hover, que no existe en
          touch). Portal a document.body + position:fixed: así no depende
          de que el contenedor (o cualquier ancestro) tenga overflow
          visible ni espacio propio reservado en el layout. */}
      {mounted && hovering && createPortal(
        <div
          className="pointer-events-none fixed z-[70] hidden rounded-2xl border border-border bg-surface shadow-2xl md:block"
          style={{
            ...panelStyle,
            // encodeURI + comillas: si el nombre del archivo subido tiene
            // paréntesis, espacios sin codificar, etc. (ver comentario en
            // AdminProductsClient.uploadImages), un `url(...)` SIN
            // comillas corta el valor en el primer paréntesis/espacio y
            // el panel queda negro (sin imagen). Esto cubre también las
            // imágenes que ya están subidas con esos nombres, no solo
            // las nuevas.
            backgroundImage: `url("${encodeURI(src)}")`,
            backgroundRepeat: 'no-repeat',
            backgroundSize: '250%', // nivel de ampliación
            backgroundPosition: bgPos,
          }}
        />,
        document.body
      )}

      {/* ── Lightbox fullscreen ── */}
      {mounted && lightboxOpen && createPortal(
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
              cae dentro de la imagen — nunca queda todo en negro.
              touch-action: manipulation (no "pinch-zoom") habilita pan
              con un dedo Y pinch con dos — "pinch-zoom" a secas deja
              pellizcar pero BLOQUEA el arrastre, que era el bug. */}
          <div
            ref={scrollRef}
            className={zoomed ? 'flex-1 overflow-auto' : 'flex flex-1 items-center justify-center overflow-hidden p-4'}
            style={{ touchAction: 'manipulation' }}
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
        </div>,
        document.body
      )}
    </>
  );
}