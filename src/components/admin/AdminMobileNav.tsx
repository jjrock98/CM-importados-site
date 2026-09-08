'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Menu, X, LayoutDashboard, Package, ShoppingBag,
  Users, MessageSquare, Settings, Star,
} from 'lucide-react';
import { cn } from '@/utils';

const LINKS = [
  { href: '/admin',               icon: LayoutDashboard, label: 'Dashboard'     },
  { href: '/admin/productos',     icon: Package,         label: 'Productos'     },
  { href: '/admin/pedidos',       icon: ShoppingBag,     label: 'Pedidos'       },
  { href: '/admin/clientes',      icon: Users,           label: 'Clientes'      },
  { href: '/admin/resenas',       icon: Star,            label: 'Reseñas'       },
  { href: '/admin/mensajes',      icon: MessageSquare,   label: 'Mensajes'      },
  { href: '/admin/configuracion', icon: Settings,        label: 'Configuración' },
];

interface Props {
  /** Campana de notificaciones/push — se recibe como prop en vez de
   *  importarla acá para no duplicar su propio import en cada lugar que
   *  compone la topbar; se ubica al lado del botón de menú. */
  notifications?: React.ReactNode;
}

export function AdminMobileNav({ notifications }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3">
        <p className="font-display font-bold text-brand-600 text-sm">Admin Panel</p>
        <div className="flex items-center gap-1">
          {notifications}
          <button onClick={() => setOpen(!open)} className="btn-ghost p-2" aria-label="Menú admin">
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Drawer overlay */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 animate-fade-in"
            onClick={() => setOpen(false)}
          />
          <nav className="fixed left-0 top-0 bottom-0 z-50 w-64 bg-surface shadow-2xl animate-slide-in-right pt-16">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 btn-ghost p-1.5"
              aria-label="Cerrar menú"
            >
              <X size={20} />
            </button>
            <div className="px-3 py-4 space-y-0.5">
              {LINKS.map(({ href, icon: Icon, label }) => {
                const active = pathname === href || (href !== '/admin' && pathname.startsWith(href));
                return (
                  <Link
                    key={href} href={href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all',
                      active
                        ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:text-brand-400'
                        : 'text-muted hover:bg-surface-2 hover:text-foreground'
                    )}
                  >
                    <Icon size={17} /> {label}
                  </Link>
                );
              })}
              <div className="pt-4 border-t border-border mt-4">
                <Link href="/" onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-muted hover:bg-surface-2 transition-all">
                  ← Volver a la tienda
                </Link>
              </div>
            </div>
          </nav>
        </>
      )}
    </div>
  );
}