'use client';
import { MessageCircle } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { cn } from '@/utils';
import { useNearPageBottom } from '@/hooks/useNearPageBottom';
import { useHideWhileScrolling } from '@/hooks/useHideWhileScrolling';

export function WhatsAppButton() {
  const number  = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
  const message = encodeURIComponent(process.env.NEXT_PUBLIC_WHATSAPP_MESSAGE ?? 'Hola!');
  // Se oculta con un fade al acercarse al footer para no tapar sus enlaces
  // en mobile (poco espacio horizontal), y reaparece al alejarse.
  const nearBottom = useNearPageBottom();
  // En celular también se corre mientras se hace scroll y vuelve al frenar.
  const scrolling = useHideWhileScrolling();
  const pathname = usePathname();
  // El panel de admin (/admin/*) es un cliente para uso interno, no de
  // compra — este botón no tiene sentido ahí y, en mobile, tapaba filas
  // de la tabla de productos (imagen + nombre a la izquierda).
  if (pathname?.startsWith('/admin')) return null;
  if (!number) return null;

  return (
    <a
      href={`https://wa.me/${number}?text=${message}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contactar por WhatsApp"
      // Tawk.to se inyecta en la esquina inferior derecha con un z-index muy
      // alto, tapando cualquier otro botón flotante que esté ahí. Por eso
      // este botón va a la esquina inferior IZQUIERDA.
      className={cn(
        'buybar-lift fixed bottom-4 left-4 z-50 flex h-12 w-12 items-center justify-center sm:bottom-6 sm:left-6 sm:h-14 sm:w-14',
        'rounded-full bg-green-500 text-white shadow-lg transition-all',
        'duration-300 hover:scale-110 hover:bg-green-600 active:scale-95',
        nearBottom || scrolling ? 'opacity-0 translate-y-4 pointer-events-none' : 'opacity-100 translate-y-0'
      )}
    >
      <MessageCircle className="h-[22px] w-[22px] sm:h-[26px] sm:w-[26px]" strokeWidth={2.2} />
    </a>
  );
}