'use client';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Search } from 'lucide-react';
import { formatPrice } from '@/utils';

interface Suggestion {
  nombre: string;
  slug: string;
  imagen: string | null;
  precio_docena: number | null;
}

interface Props {
  /** desktop = pill de la barra superior; mobile = campo del menú hamburguesa */
  variant: 'desktop' | 'mobile';
  /** Se llama después de navegar (ej: cerrar el menú mobile) */
  onNavigate?: () => void;
}

const MIN_CHARS = 2;
const DEBOUNCE_MS = 250;

/**
 * Miniatura del producto. Usa next/image (igual que ProductCard): la imagen
 * pasa por /_next/image del propio sitio, así no depende de cómo esté
 * configurado el acceso directo al storage. Si falla, muestra un cuadro
 * neutro en vez del ícono de imagen rota.
 */
function Thumb({ src }: { src: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <span className="h-9 w-9 shrink-0 rounded bg-surface-2" />;
  return (
    <Image
      src={src}
      alt=""
      width={36}
      height={36}
      sizes="36px"
      onError={() => setFailed(true)}
      className="h-9 w-9 shrink-0 rounded object-cover bg-surface-2"
    />
  );
}

/** Quita acentos y pasa a minúsculas ("Pantalón" → "pantalon"). */
const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Resalta en negrita la parte del nombre que coincide con lo escrito (sin distinguir acentos). */
function Highlight({ text, term }: { text: string; term: string }) {
  const folded = fold(text);
  const needle = fold(term);
  // Si quitar acentos cambió el largo (texto descompuesto), no se resalta: los índices no coincidirían.
  const i = folded.length === text.length && needle ? folded.indexOf(needle) : -1;
  if (i === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <strong className="font-semibold text-foreground">{text.slice(i, i + needle.length)}</strong>
      {text.slice(i + needle.length)}
    </>
  );
}

export function SearchAutocomplete({ variant, onNavigate }: Props) {
  const router = useRouter();
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const cache = useRef(new Map<string, Suggestion[]>());
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);

  const term = query.trim();

  // Pide sugerencias con debounce y cancela el pedido anterior si se sigue tipeando.
  useEffect(() => {
    if (term.length < MIN_CHARS) {
      setItems([]); setLoading(false); setActive(-1);
      return;
    }
    const key = term.toLowerCase();
    const cached = cache.current.get(key);
    if (cached) { setItems(cached); setActive(-1); return; }

    const ctrl = new AbortController();
    const t = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error('bad status');
        const json = (await res.json()) as { items: Suggestion[] };
        cache.current.set(key, json.items);
        setItems(json.items);
        setActive(-1);
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setItems([]);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => { window.clearTimeout(t); ctrl.abort(); };
  }, [term]);

  // Cerrar al hacer clic afuera.
  useEffect(() => {
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown, { passive: true });
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, []);

  const go = useCallback((href: string) => {
    setOpen(false);
    setQuery('');
    setItems([]);
    router.push(href);
    onNavigate?.();
  }, [router, onNavigate]);

  const goSearch = useCallback(() => {
    if (term.length >= MIN_CHARS) go(`/buscar?q=${encodeURIComponent(term)}`);
  }, [term, go]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (active >= 0 && items[active]) go(`/productos/${items[active].slug}`);
    else goSearch();
  };

  // Filas navegables: los productos + "Ver todos los resultados".
  const rows = items.length + (term.length >= MIN_CHARS ? 1 : 0);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (!rows) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault(); setOpen(true);
      setActive((a) => (a + 1) % rows);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); setOpen(true);
      setActive((a) => (a <= 0 ? rows - 1 : a - 1));
    } else if (e.key === 'Enter' && active === items.length) {
      // Enter sobre "Ver todos los resultados"
      e.preventDefault(); goSearch();
    }
  };

  const showDropdown = open && term.length >= MIN_CHARS && (items.length > 0 || loading || !loading);

  const input = (
    <input
      type="search"
      role="combobox"
      aria-expanded={showDropdown}
      aria-controls={listId}
      aria-autocomplete="list"
      aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
      autoComplete="off"
      value={query}
      onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
      onFocus={() => setOpen(true)}
      onKeyDown={onKeyDown}
      maxLength={100}
      placeholder="Buscar productos…"
      className={
        variant === 'desktop'
          ? 'w-full bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none [&::-webkit-search-cancel-button]:hidden'
          : 'input-base flex-1 py-2 text-sm'
      }
    />
  );

  return (
    <div ref={wrapRef} className="relative w-full">
      <form onSubmit={onSubmit} role="search" className={variant === 'desktop' ? '' : 'flex gap-2'}>
        {variant === 'desktop' ? (
          <div className="flex w-full items-center overflow-hidden rounded-lg border border-border bg-surface-2">
            {input}
            <button type="submit" className="flex h-full items-center justify-center bg-brand-700 px-3 py-2 text-white shrink-0" aria-label="Buscar">
              <Search size={16} />
            </button>
          </div>
        ) : (
          <>
            {input}
            <button type="submit" className="btn-primary px-3 py-2 text-sm" aria-label="Buscar">
              <Search size={15} />
            </button>
          </>
        )}
      </form>

      {showDropdown && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-border bg-surface shadow-xl"
        >
          {items.map((p, i) => (
            <li key={p.slug} id={`${listId}-${i}`} role="option" aria-selected={active === i}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => go(`/productos/${p.slug}`)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm ${active === i ? 'bg-surface-2' : ''}`}
              >
                <Thumb src={p.imagen} />
                <span className="min-w-0 flex-1 truncate text-muted">
                  <Highlight text={p.nombre} term={term} />
                </span>
                {p.precio_docena != null && (
                  <span className="shrink-0 text-xs text-muted">{formatPrice(p.precio_docena)} <span className="opacity-70">x docena</span></span>
                )}
              </button>
            </li>
          ))}

          {!loading && items.length === 0 && (
            <li className="px-3 py-3 text-sm text-muted" role="presentation">
              Sin sugerencias para “{term}”.
            </li>
          )}
          {loading && items.length === 0 && (
            <li className="px-3 py-3 text-sm text-muted" role="presentation">Buscando…</li>
          )}

          <li id={`${listId}-${items.length}`} role="option" aria-selected={active === items.length} className="border-t border-border">
            <button
              type="button"
              onMouseEnter={() => setActive(items.length)}
              onClick={goSearch}
              className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium ${active === items.length ? 'bg-surface-2' : ''}`}
            >
              <Search size={14} className="shrink-0" />
              <span className="truncate">Ver todos los resultados para “{term}”</span>
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}