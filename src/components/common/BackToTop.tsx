'use client';
import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { cn } from '@/utils';

export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <button
      onClick={scrollTop}
      aria-label="Volver al inicio de la página"
      className={cn(
        'fixed bottom-24 right-6 z-40 flex h-10 w-10 items-center justify-center rounded-full',
        'border border-border bg-surface shadow-lg transition-all duration-300',
        'hover:border-brand-500 hover:text-brand-600 hover:scale-110',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      )}
    >
      <ArrowUp size={17} />
    </button>
  );
}
