import { cn } from '@/utils';

export function splitBrandName(name: string): { mark: string; rest: string } {
  const clean = name.trim().replace(/\s+/g, ' ');
  const i = clean.indexOf(' ');
  if (i > 0 && i <= 4) return { mark: clean.slice(0, i), rest: clean.slice(i + 1) };
  return { mark: clean, rest: '' };
}

interface Props {
  name: string;
  tone?: 'light' | 'dark';
  className?: string;
}

export function BrandWordmark({ name, tone = 'light', className }: Props) {
  const { mark, rest } = splitBrandName(name);
  const dark = tone === 'dark';

  // ✅ Función para renderizar la sigla aislando el "&" para que no se vea como un "8"
  const renderMark = (text: string) => {
    if (text.includes('&')) {
      const [first, second] = text.split('&');
      return (
        <>
          {first}
          <span className="font-sans italic font-medium px-1 text-[22px] align-baseline opacity-90">
            &
          </span>
          {second}
        </>
      );
    }
    return text;
  };

  if (!rest) {
    return (
      <span
        className={cn(
          'font-display text-xl font-bold leading-none',
          dark ? 'text-white' : 'text-brand-700 dark:text-white',
          className,
        )}
      >
        {renderMark(mark)}
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
        {renderMark(mark)}
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