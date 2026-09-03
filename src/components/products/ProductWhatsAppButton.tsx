'use client';
import { MessageCircle } from 'lucide-react';

interface Props {
  productName: string;
  productUrl?: string;
}

/**
 * Botón + aviso de WhatsApp por producto — para que el cliente consulte
 * un descuento especial llevando la caja completa cerrada (sin abrir el
 * pack surtido). El precio de caja cerrada se coordina personalmente por
 * WhatsApp, no está publicado en la tienda a propósito (varía según
 * volumen y disponibilidad real de cajas completas del proveedor).
 */
export function ProductWhatsAppButton({ productName, productUrl }: Props) {
  const number = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
  if (!number) return null;

  const mensaje = `Hola! Te consulto por "${productName}" — ¿tenés descuento llevando la caja completa cerrada?${productUrl ? `\n${productUrl}` : ''}`;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted leading-relaxed bg-surface-2 rounded-lg px-3 py-2">
        📦 Llevando la <strong>caja completa cerrada</strong> el descuento aumenta y sale todavía más económico —
        se coordina el precio personalmente por WhatsApp.
      </p>
      <a
        href={`https://wa.me/${number}?text=${encodeURIComponent(mensaje)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 w-full rounded-xl border border-green-500/30
                   bg-green-50 dark:bg-green-950/20 px-4 py-2.5 text-sm font-medium text-green-700
                   dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-950/40 transition-colors"
      >
        <MessageCircle size={16} />
        Consultar precio por caja cerrada
      </a>
    </div>
  );
}
