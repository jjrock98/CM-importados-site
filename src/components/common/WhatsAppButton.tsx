'use client';
import { MessageCircle } from 'lucide-react';
import { cn } from '@/utils';
import { useNearPageBottom } from '@/hooks/useNearPageBottom';

export function WhatsAppButton() {
  const number  = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
  const message = encodeURIComponent(process.env.NEXT_PUBLIC_WHATSAPP_MESSAGE ?? 'Hola!');
  // Se oculta con un fade al acercarse al footer para no tapar sus enlaces
  // en mobile (poco espacio horizontal), y reaparece al alejarse.
  const nearBottom = useNearPageBottom();
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
        'fixed bottom-6 left-6 z-50 flex h-14 w-14 items-center justify-center',
        'rounded-full bg-green-500 text-white shadow-lg transition-all',
        'duration-300 hover:scale-110 hover:bg-green-600 active:scale-95',
        nearBottom ? 'opacity-0 translate-y-4 pointer-events-none' : 'opacity-100 translate-y-0'
      )}
    >
      <MessageCircle size={26} strokeWidth={2.2} />
    </a>
  );
}