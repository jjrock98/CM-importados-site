'use client';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Mail, ShoppingBag, UserPlus, Search } from 'lucide-react';

/**
 * Página de confirmación para compradores invitados.
 * No requiere login — solo muestra el número de pedido y el email
 * al que se envió la confirmación.
 */
export function PedidoConfirmadoContent() {
  const params    = useSearchParams();
  const orderId   = params.get('orderId') ?? '';
  const email     = params.get('email')   ?? '';
  const orderNum  = orderId.slice(0, 8).toUpperCase();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-16 text-center">
      {/* Ícono de éxito */}
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-green-400/20 animate-pulse" />
        <div className="relative rounded-full bg-green-50 dark:bg-green-950/30 p-6">
          <CheckCircle2 size={56} className="text-green-500" />
        </div>
      </div>

      {/* Heading */}
      <div className="space-y-3 max-w-md">
        <h1 className="font-display text-3xl font-bold text-green-700 dark:text-green-400">
          ¡Pedido recibido!
        </h1>
        <p className="text-muted leading-relaxed">
          Gracias por tu compra. Procesaremos tu pedido a la brevedad.
        </p>
      </div>

      {/* Número de pedido */}
      {orderNum && (
        <div className="card border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/10 px-8 py-5 text-center">
          <p className="text-xs text-muted uppercase tracking-widest mb-1">Número de pedido</p>
          <p className="font-mono text-3xl font-black text-green-700 dark:text-green-300">
            #{orderNum}
          </p>
          <p className="text-xs text-muted mt-1">Guardá este número para hacer seguimiento</p>
        </div>
      )}

      {/* Confirmación por email */}
      {email && (
        <div className="flex items-start gap-3 max-w-sm text-left card px-5 py-4">
          <Mail size={18} className="text-brand-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">Confirmación enviada</p>
            <p className="text-xs text-muted mt-0.5">
              Te mandamos los detalles del pedido a{' '}
              <strong className="text-foreground">{email}</strong>
            </p>
          </div>
        </div>
      )}

      {/* Seguimiento sin login */}
      {orderId && (
        <Link
          href={`/seguimiento?id=${orderId}&email=${encodeURIComponent(email)}`}
          className="btn-secondary gap-2"
        >
          <Search size={15} /> Ver estado del pedido
        </Link>
      )}

      {/* CTAs */}
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <div className="flex items-start gap-3 card px-4 py-3 text-left">
          <UserPlus size={16} className="text-brand-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold">¿Querés guardar tu historial?</p>
            <p className="text-xs text-muted mt-0.5">
              <Link href="/auth/registro" className="text-brand-600 underline">
                Creá una cuenta gratuita
              </Link>{' '}
              y seguí todos tus pedidos desde un solo lugar.
            </p>
          </div>
        </div>
        <Link href="/" className="btn-ghost gap-2 justify-center text-sm">
          <ShoppingBag size={15} /> Seguir comprando
        </Link>
      </div>
    </div>
  );
}
