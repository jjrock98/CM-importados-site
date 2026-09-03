'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Users, LayoutDashboard, Package, ShoppingBag, MapPin, Mail,
  MessageSquare, Settings, Building2, ChevronRight
} from 'lucide-react';
import { cn } from '@/utils';

const LINKS = [
  { href: '/admin',                icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/admin/productos',      icon: Package,         label: 'Productos' },
  { href: '/admin/pedidos',        icon: ShoppingBag,     label: 'Pedidos' },
  { href: '/admin/clientes',       icon: Users,           label: 'Clientes' },
  { href: '/admin/mensajes',       icon: MessageSquare,   label: 'Mensajes' },
  { href: '/admin/configuracion',  icon: Settings,        label: 'Configuración' },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-60 flex-col border-r border-border bg-surface">
      <div className="px-5 py-5 border-b border-border">
        <p className="font-display font-bold text-brand-600">Admin Panel</p>
        <p className="text-xs text-muted">Gestión de tienda</p>
      </div>
      <nav className="flex-1 py-4 px-3 space-y-0.5">
        {LINKS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== '/admin' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                active
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:text-brand-400'
                  : 'text-muted hover:bg-surface-2 hover:text-foreground'
              )}
            >
              <Icon size={17} />
              {label}
              {active && <ChevronRight size={14} className="ml-auto" />}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-border">
        <Link href="/" className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs text-muted hover:bg-surface-2 transition-all">
          ← Volver a la tienda
        </Link>
      </div>
    </aside>
  );
}
