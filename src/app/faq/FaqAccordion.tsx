'use client';
import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/utils';
import { FAQS } from './faqs-data';

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 py-5 text-left"
        aria-expanded={open}
        aria-controls={panelId}
      >
        <span className="font-medium text-sm md:text-base">{q}</span>
        <ChevronDown size={18} className={cn('shrink-0 text-muted transition-transform duration-200', open && 'rotate-180')} />
      </button>

      {/*
        ✅ FIX SEO/GEO: antes esto era `{open && <p>{a}</p>}`, o sea que la
        respuesta NO se renderizaba en absoluto hasta el primer click. Eso
        significa que el HTML servido (lo que ve cualquier buscador o
        sistema que arma respuestas con IA, incluido el "Modo IA" de
        Google) tenía las 10 preguntas pero NINGUNA respuesta — justo el
        contenido tipo pregunta/respuesta que esos sistemas más citan.

        Ahora el <p> siempre está en el DOM; el acordeón colapsa/expande
        con CSS puro (grid-rows 0fr↔1fr + overflow-hidden), no dejando de
        montar el nodo. Visualmente se ve idéntico a antes.
      */}
      <div
        id={panelId}
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-200 ease-in-out',
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        )}
      >
        <div className="overflow-hidden">
          <p className="pb-5 text-sm text-muted leading-relaxed">{a}</p>
        </div>
      </div>
    </div>
  );
}

export function FaqAccordion() {
  return (
    <div className="card px-6">
      {FAQS.map((item) => <FaqItem key={item.q} {...item} />)}
    </div>
  );
}