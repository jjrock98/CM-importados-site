'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { ShoppingCart, Heart, Menu, X, User, Sun, Moon, Search } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useCartStore } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/utils';

const LINKS = [
  { href: '/',              label: 'Inicio'       },
  { href: '/productos',     label: 'Productos'    },
  { href: '/pedido-rapido', label: 'Pedido rápido' },
  // Canal minorista desactivado (venta solo mayorista) — se quita del menú
  // pero la página /minorista sigue en el código por si se reactiva.
  { href: '/faq',        label: 'FAQ'       },
  { href: '/contacto',   label: 'Contacto'  },
  { href: '/ubicacion',  label: 'Ubicación' },
];

export function Navbar() {
  const pathname     = usePathname();
  const router       = useRouter();
  const [open,       setOpen]      = useState(false);
  const [userMenu,   setUserMenu]  = useState(false);
  const [query,      setQuery]     = useState('');
  const searchRef    = useRef<HTMLInputElement>(null);
  const { theme, setTheme } = useTheme();
  // ✅ FIX hidratación: `theme` es `undefined` en el primer render (SSR y
  // primer paint del cliente) hasta que next-themes lee localStorage en un
  // useEffect. Si renderizamos el ícono directamente en base a `theme`,
  // el servidor siempre pinta <Moon /> y el cliente puede repintar <Sun />
  // apenas monta, lo que genera el mismatch. Con `mounted` retrasamos el
  // render del ícono real hasta después del montaje, cuando servidor y
  // cliente ya están sincronizados.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const itemCount = useCartStore((s) => s.itemCount);
  const { user, profile, isAdmin, signOut } = useAuth();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length >= 2) {
      router.push(`/buscar?q=${encodeURIComponent(query.trim())}`);
      setQuery('');
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-surface">
      {/* ── Barra superior — fondo claro/oscuro según el tema (igual que el
          resto del sitio), con el navy de marca solo como acento en el
          logo, el botón de buscar y el botón "Mi Cuenta" — así queda fiel
          a la referencia visual (header blanco, navy como detalle, no de
          fondo). ── */}
      <div className="border-b border-border">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <Image
              src="/logo.png"
              alt={process.env.NEXT_PUBLIC_TIENDA_NOMBRE ?? 'MC Importados'}
              width={34}
              height={34}
              className="rounded-lg object-contain"
              priority
            />
            <span className="font-display text-base font-bold text-brand-700 dark:text-brand-300 hidden sm:inline">
              {process.env.NEXT_PUBLIC_TIENDA_NOMBRE ?? 'MC Importados'}
            </span>
          </Link>

          {/* Search — pill claro con borde, botón de buscar en navy sólido */}
          <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-md">
            <div className="flex w-full items-center overflow-hidden rounded-lg border border-border bg-surface-2">
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar productos…"
                className="w-full bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none"
              />
              <button type="submit" className="flex h-full items-center justify-center bg-brand-700 px-3 py-2 text-white shrink-0" aria-label="Buscar">
                <Search size={16} />
              </button>
            </div>
          </form>

          <div className="flex-1 md:hidden" />

          {/* Actions — en escritorio el buscador tiene max-w-md, así que en
              pantallas anchas sobra espacio horizontal después de él. Con
              md:ml-auto forzamos que este grupo (sol, carrito, mi cuenta)
              quede siempre pegado a la esquina derecha del header, sin
              afectar el layout mobile (que ya usa el spacer de arriba). */}
          <div className="flex items-center gap-1 shrink-0 md:ml-auto">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="rounded-lg p-2 text-muted hover:bg-surface-2 transition-colors"
              aria-label="Cambiar tema"
            >
              {mounted ? (
                theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />
              ) : (
                <span className="block h-[18px] w-[18px]" aria-hidden="true" />
              )}
            </button>

            {user && (
              <Link href="/wishlist" className="rounded-lg p-2 text-muted hover:bg-surface-2 transition-colors" aria-label="Wishlist">
                <Heart size={18} />
              </Link>
            )}

            {/* Carrito — badge navy con cantidad de packs */}
            <Link href="/carrito" className="relative flex items-center gap-1.5 rounded-lg px-2 py-2 text-muted hover:bg-surface-2 transition-colors" aria-label="Carrito">
              <ShoppingCart size={18} />
              <span className="hidden lg:inline text-xs font-medium">
                {itemCount > 0 ? `${itemCount} ${itemCount === 1 ? 'Pack' : 'Packs'}` : 'Carrito'}
              </span>
              {itemCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white lg:hidden">
                  {itemCount > 9 ? '9+' : itemCount}
                </span>
              )}
            </Link>

            {/* User */}
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenu(!userMenu)}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted hover:bg-surface-2 transition-colors"
                >
                  <User size={16} />
                  <span className="hidden md:block max-w-20 truncate">
                    {profile?.nombre?.split(' ')[0] ?? 'Mi cuenta'}
                  </span>
                </button>
                {userMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setUserMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 z-20 w-44 rounded-xl border border-border bg-surface text-foreground shadow-lg">
                      <Link href="/perfil"       className="block px-4 py-2.5 text-sm hover:bg-surface-2" onClick={() => setUserMenu(false)}>Mi perfil</Link>
                      <Link href="/mis-pedidos"  className="block px-4 py-2.5 text-sm hover:bg-surface-2" onClick={() => setUserMenu(false)}>Mis pedidos</Link>
                      <Link href="/wishlist"     className="block px-4 py-2.5 text-sm hover:bg-surface-2" onClick={() => setUserMenu(false)}>Wishlist</Link>
                      {isAdmin && (
                        <Link href="/admin" className="block px-4 py-2.5 text-sm text-brand-600 font-medium hover:bg-surface-2" onClick={() => setUserMenu(false)}>
                          Panel Admin
                        </Link>
                      )}
                      <div className="border-t border-border" />
                      <button onClick={() => { signOut(); setUserMenu(false); }}
                        className="w-full px-4 py-2.5 text-left text-sm text-red-500 hover:bg-surface-2">
                        Cerrar sesión
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <Link href="/auth/login" className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-muted hover:bg-surface-2 transition-colors">
                <User size={14} /> Mi Cuenta
              </Link>
            )}

            {/* Mobile menu toggle */}
            <button
              className="rounded-lg p-2 text-muted hover:bg-surface-2 transition-colors md:hidden"
              onClick={() => setOpen(!open)}
              aria-label="Menú"
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Fila de navegación ── */}
      <nav className="hidden md:block border-b border-border bg-surface-2/60">
        <ul className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-2.5">
          {LINKS.map(({ href, label }) => (
            <li key={href}>
              <Link href={href} className={cn(
                'text-sm font-medium transition-colors hover:text-brand-600',
                pathname === href ? 'text-brand-600' : 'text-muted'
              )}>
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-border bg-surface px-4 pb-4 md:hidden animate-fade-in">
          <form onSubmit={handleSearch} className="mt-3 flex gap-2">
            <input
              value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar productos…"
              className="input-base flex-1 py-2 text-sm"
            />
            <button type="submit" className="btn-primary px-3 py-2 text-sm">
              <Search size={15} />
            </button>
          </form>

          <ul className="mt-3 space-y-1">
            {LINKS.map(({ href, label }) => (
              <li key={href}>
                <Link href={href}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-surface-2"
                  onClick={() => setOpen(false)}>
                  {label}
                </Link>
              </li>
            ))}
            {user && (
              <>
                <li><Link href="/perfil"      className="block rounded-lg px-3 py-2.5 text-sm hover:bg-surface-2" onClick={() => setOpen(false)}>Mi perfil</Link></li>
                <li><Link href="/mis-pedidos" className="block rounded-lg px-3 py-2.5 text-sm hover:bg-surface-2" onClick={() => setOpen(false)}>Mis pedidos</Link></li>
              </>
            )}
          </ul>
        </div>
      )}
    </header>
  );
}