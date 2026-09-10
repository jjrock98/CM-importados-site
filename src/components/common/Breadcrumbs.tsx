import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { env } from '@/env';

export interface BreadcrumbItem {
  name: string;
  /** URL absoluta o relativa. El último ítem normalmente no lleva Link (página actual). */
  url: string;
}

interface Props {
  items: BreadcrumbItem[];
  /** Dominio base para armar las URLs absolutas del JSON-LD (requerido por schema.org) */
  appUrl?: string;
  className?: string;
}

/**
 * Migas de pan reutilizables — render visual (gris/marca, con truncado en
 * textos largos) + su propio JSON-LD `BreadcrumbList` inyectado
 * internamente, para no tener que duplicar esa lógica en cada página que
 * las use.
 */
export function Breadcrumbs({ items, appUrl, className }: Props) {
  const base = appUrl ?? env.APP_URL;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type':    'BreadcrumbList',
    itemListElement: items.map((item, idx) => ({
      '@type':   'ListItem',
      position:  idx + 1,
      name:      item.name,
      item:      item.url.startsWith('http') ? item.url : `${base}${item.url}`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <nav aria-label="Breadcrumb" className={className ?? 'mb-6 flex items-center gap-1.5 text-sm text-muted'}>
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <span key={item.url} className="flex items-center gap-1.5 min-w-0">
              {idx > 0 && <ChevronRight size={14} className="shrink-0 text-muted/60" aria-hidden />}
              {isLast ? (
                <span
                  className="max-w-[200px] truncate text-foreground font-medium sm:max-w-xs"
                  aria-current="page"
                >
                  {item.name}
                </span>
              ) : (
                <Link
                  href={item.url}
                  className="max-w-[140px] truncate text-muted hover:text-brand-600 transition-colors sm:max-w-[200px]"
                >
                  {item.name}
                </Link>
              )}
            </span>
          );
        })}
      </nav>
    </>
  );
}