'use client';
import { MessageCircle } from 'lucide-react';

export function WhatsAppButton() {
  const number  = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
  const message = encodeURIComponent(process.env.NEXT_PUBLIC_WHATSAPP_MESSAGE ?? 'Hola!');
  if (!number) return null;

  return (
    <a
      href={`https://wa.me/${number}?text=${message}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contactar por WhatsApp"
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center
                 rounded-full bg-green-500 text-white shadow-lg transition-all
                 duration-300 hover:scale-110 hover:bg-green-600 active:scale-95"
    >
      <MessageCircle size={26} strokeWidth={2.2} />
    </a>
  );
}
