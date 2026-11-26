import { cn } from '@/utils';

/**
 * Separa el nombre de la marca en sigla y resto, para armar el mismo "lockup"
 * que el logotipo: "L&L importados" → { mark: 'L&L', rest: 'importados' }.
 * Solo se separa si la primera palabra es corta (hasta 4 caracteres, como
 * "L&L" o "MC"); con nombres largos se muestra todo junto.
 */
export function splitBrandName(name: string): { mark: string; rest: string } {
  const clean = name.trim().replace(/\s+/g, ' ');
  const i = clean.indexOf(' ');
  if (i > 0 && i <= 4) return { mark: clean.slice(0, i), rest: clean.slice(i + 1) };
  return { mark: clean, rest: '' };
}

interface Props {
  name: string;
  /** `light`: sobre fondo claro (encabezado). `dark`: sobre fondo oscuro (pie). */
  tone?: 'light' | 'dark';
  className?: string;
}

/**
 * Nombre de la marca con el estilo del logotipo: sigla grande en serif y el
 * resto en mayúsculas pequeñas y espaciadas.
 */
export function BrandWordmark({ name, tone = 'light', className }: Props) {
  const { mark, rest } = splitBrandName(name);
  const dark = tone === 'dark';

  if (!rest) {
    return (
      <span
        className={cn(
          'font-display text-xl font-bold leading-none',
          dark ? 'text-white' : 'text-brand-700 dark:text-white',
          className,
        )}
      >
        {mark}
      </span>
    );
  }

  return (
    <span className={cn('inline-flex flex-col justify-center leading-none', className)}>
      <span
        className={cn(
          'font-display text-[27px] font-bold tracking-tight',
          dark ? 'text-white' : 'text-brand-700 dark:text-white',
        )}
      >
        {mark}
      </span>
      <span
        className={cn(
          'mt-1.25 text-[10px] font-medium uppercase tracking-[0.28em]',
          dark ? 'text-accent-300' : 'text-accent-600 dark:text-accent-300',
        )}
      >
        {rest}
      </span>
    </span>
  );
}