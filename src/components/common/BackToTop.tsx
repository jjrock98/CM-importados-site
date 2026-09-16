'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ArrowUp } from 'lucide-react';
import { cn } from '@/utils';

export function BackToTop() {
  const [visible, setVisible] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  // El panel de admin (/admin/*) tiene tablas con acciones (editar/borrar)
  // pegadas al borde derecho: este botón fixed en bottom-right quedaba
  // flotando justo encima de esos íconos y tapaba los clicks al lápiz de
  // "Editar producto" en filas que caían en esa posición de la pantalla.
  // Antes directamente no se mostraba en admin. Ahora sí se muestra (las
  // listas de admin pueden ser largas en mobile), pero: (1) va más chico
  // para molestar menos visualmente, y (2) el layout de admin
  // (src/app/admin/layout.tsx) le reserva una franja vacía al final del
  // contenido en mobile (padding-bottom) para que, aunque el botón quede
  // fijo en esa esquina, nunca haya una fila real de la tabla debajo de
  // él — el WhatsApp/Tawk.to que antes ocupaban esa esquina ya se ocultan
  // en /admin (ver WhatsAppButton.tsx y TawkTo.tsx), así que la esquina
  // queda libre para este botón.
  const isAdmin = pathname?.startsWith('/admin') ?? false;

  return (
    <button
      onClick={scrollTop}
      aria-label="Volver al inicio de la página"
      className={cn(
        'fixed z-40 flex items-center justify-center rounded-full',
        'border border-border bg-surface shadow-lg transition-all duration-300',
        'hover:border-brand-500 hover:text-brand-600 hover:scale-110',
        isAdmin ? 'bottom-4 right-4 h-9 w-9' : 'bottom-24 right-6 h-10 w-10',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      )}
    >
      <ArrowUp size={isAdmin ? 15 : 17} />
    </button>
  );
}