'use client';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Receipt,
  Clock,
  Mail,
  MapPin,
  CheckCircle2,
  ArrowRight,
  ShoppingBag,
  CalendarClock,
} from 'lucide-react';
import { getCashCouponExpiry } from '@/utils';

/**
 * Pantalla de "pedido reservado" tras elegir pago en efectivo en Mercado Pago.
 *
 * Contexto: el usuario salió del entorno de MP con un cupón generado pero
 * SIN pagar todavía. El webhook procesará el estado real cuando:
 *  - el cliente pague el cupón → status 'approved' → estado 'pagado'
 *  - el cupón venza sin pago    → status 'cancelled' → estado 'cancelado'
 *
 * Esta página NO consulta el estado en tiempo real (eso lo hace
 * /mis-pedidos/[id]) — su único objetivo es comunicar tranquilidad
 * y los próximos pasos de forma clara y empática.
 */
export function PendingContent() {
  const params  = useSearchParams();
  const orderId = params.get('orderId') ?? params.get('external_reference');
  const expiry  = getCashCouponExpiry();

  const STEPS = [
    {
      icon: Mail,
      title: 'Revisá tu email',
      desc: 'Mercado Pago te envió el cupón con el código de barras para pagar.',
    },
    {
      icon: MapPin,
      title: 'Pagalo en un punto habilitado',
      desc: 'Rapipago, Pago Fácil, Provincia NET o Cobroexpress.',
    },
    {
      icon: CheckCircle2,
      title: 'Confirmación automática',
      desc: 'En cuanto se acredite el pago (puede tardar unos minutos), confirmamos tu pedido solo.',
    },
  ];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-16 text-center bg-surface">
      {/* ── Icon ─────────────────────────────────────────────── */}
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-amber-400/20 animate-pulse" />
        <div className="relative rounded-full bg-amber-50 dark:bg-amber-950/30 p-6">
          <Receipt size={56} className="text-amber-500" />
        </div>
      </div>

      {/* ── Heading ──────────────────────────────────────────── */}
      <div className="space-y-3 max-w-md">
        <h1 className="font-display text-3xl font-bold text-amber-700 dark:text-amber-400">
          ¡Tu pedido está reservado!
        </h1>
        <p className="text-muted leading-relaxed">
          Generamos tu cupón de pago en efectivo. Tomate tu tiempo — guardamos
          tus productos mientras lo abonás.
        </p>
        {orderId && (
          <p className="text-sm font-mono text-muted">
            Pedido <strong className="text-foreground">#{orderId.slice(0, 8).toUpperCase()}</strong>
          </p>
        )}
      </div>

      {/* ── Expiry notice ────────────────────────────────────── */}
      <div className="card border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 px-5 py-4 max-w-md w-full text-left">
        <div className="flex items-start gap-3">
          <CalendarClock size={20} className="text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              Tenés hasta el {expiry} para pagar
            </p>
            <p className="text-xs text-amber-700/80 dark:text-amber-400/70 mt-1">
              Si el cupón vence sin pago, el pedido se cancela automáticamente
              y los productos vuelven al stock disponible.
            </p>
          </div>
        </div>
      </div>

      {/* ── Steps ────────────────────────────────────────────── */}
      <div className="max-w-md w-full">
        <p className="text-sm font-semibold text-foreground mb-4 flex items-center justify-center gap-2">
          <Clock size={15} className="text-brand-500" />
          ¿Qué hacer ahora?
        </p>
        <div className="space-y-3">
          {STEPS.map(({ icon: Icon, title, desc }, i) => (
            <div key={title} className="card p-4 flex items-start gap-3 text-left">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 dark:bg-brand-950/30 text-brand-600 font-bold text-sm">
                {i + 1}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold flex items-center gap-1.5">
                  <Icon size={14} className="text-brand-500" />
                  {title}
                </p>
                <p className="text-xs text-muted mt-1 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── CTAs ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link href="/mis-pedidos" className="btn-primary gap-2 justify-center">
          Ver estado de mi pedido <ArrowRight size={15} />
        </Link>
        <Link href="/" className="btn-secondary gap-2 justify-center">
          <ShoppingBag size={15} /> Seguir comprando
        </Link>
      </div>

      <p className="text-xs text-muted max-w-sm">
        ¿Tenés dudas sobre el cupón o el pago?{' '}
        <Link href="/contacto" className="text-brand-600 hover:underline">
          Contactanos
        </Link>{' '}
        — estamos para ayudarte.
      </p>
    </div>
  );
}
