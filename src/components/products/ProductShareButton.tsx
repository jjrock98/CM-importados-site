'use client';
import { useEffect, useState } from 'react';
import { Share2, Check, Link2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  productName: string;
  productUrl: string;
}

/**
 * Botón para compartir el producto. En mobile (y algunos navegadores de
 * escritorio compatibles) usa la Web Share API nativa — abre el selector
 * del sistema operativo (WhatsApp, Instagram, Mail, etc). Si no está
 * disponible (la mayoría de los navegadores de escritorio), cae a copiar
 * el link al portapapeles y avisa con un toast.
 *
 * navigator.share requiere HTTPS (o localhost) y gesto de usuario directo
 * — por eso se llama dentro del propio onClick, nunca en un efecto.
 */
export function ProductShareButton({ productName, productUrl }: Props) {
  const [copiado, setCopiado] = useState(false);
  // ✅ navigator no existe en el server (SSR) — leerlo directo en el render
  // rompería la hidratación (server dibuja un ícono, cliente otro). Se
  // detecta la capacidad recién en el efecto, que solo corre en el browser,
  // así el primer render de cliente coincide siempre con el del servidor.
  const [puedeCompartirNativo, setPuedeCompartirNativo] = useState(false);
  useEffect(() => {
    setPuedeCompartirNativo(typeof navigator !== 'undefined' && !!navigator.share);
  }, []);

  const handleShare = async () => {
    // Web Share API — no existe en todos los navegadores (ej. desktop Chrome/Firefox)
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: productName,
          text: `Mirá "${productName}"`,
          url: productUrl,
        });
      } catch (err) {
        // AbortError: el usuario cerró el selector nativo sin elegir nada —
        // no es un error real, no hay que mostrar nada.
        if ((err as Error)?.name !== 'AbortError') {
          console.error('[ProductShareButton] Error al compartir:', err);
        }
      }
      return;
    }

    // Fallback: copiar al portapapeles
    try {
      await navigator.clipboard.writeText(productUrl);
      setCopiado(true);
      toast.success('Link copiado al portapapeles');
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error('No se pudo copiar el link');
    }
  };

  return (
    <button
      onClick={handleShare}
      className="flex items-center justify-center gap-2 w-full rounded-xl border border-border
                 bg-surface px-4 py-2.5 text-sm font-medium text-foreground
                 hover:bg-surface-2 transition-colors"
      aria-label={`Compartir ${productName}`}
    >
      {copiado ? (
        <>
          <Check size={16} className="text-green-600" />
          Copiado
        </>
      ) : (
        <>
          {puedeCompartirNativo ? <Share2 size={16} /> : <Link2 size={16} />}
          Compartir producto
        </>
      )}
    </button>
  );
}