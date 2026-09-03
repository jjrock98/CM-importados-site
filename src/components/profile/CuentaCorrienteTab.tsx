'use client';
import { useEffect, useState } from 'react';
import { Wallet, TrendingDown, TrendingUp } from 'lucide-react';
import { formatPrice, formatDate } from '@/utils';

interface Condiciones {
  descuento_fijo_pct: number;
  limite_cuenta_corriente: number;
  saldo_cuenta_corriente: number;
  disponible_cuenta_corriente: number;
}

interface Movimiento {
  id: string;
  tipo: 'cargo' | 'pago' | 'ajuste';
  monto: number;
  saldo_resultante: number;
  concepto: string | null;
  order_id: string | null;
  created_at: string;
}

/**
 * Estado de cuenta del cliente mayorista — saldo actual, límite disponible
 * y el historial completo de cargos (compras) y pagos. Antes de esto el
 * saldo era un número sin ningún detalle de cómo se llegó a él; ahora el
 * cliente puede ver exactamente cada movimiento, igual que un resumen de
 * tarjeta.
 */
export function CuentaCorrienteTab() {
  const [condiciones, setCondiciones] = useState<Condiciones | null>(null);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/mi-cuenta/condiciones').then((r) => r.json()),
      fetch('/api/mi-cuenta/movimientos').then((r) => r.json()),
    ])
      .then(([c, m]) => {
        setCondiciones(c.data ?? null);
        setMovimientos(m.data ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="card p-6 text-sm text-muted">Cargando estado de cuenta…</div>;
  }

  if (!condiciones || condiciones.limite_cuenta_corriente <= 0) {
    return (
      <div className="card p-6 text-sm text-muted">
        No tenés cuenta corriente habilitada. Consultanos si te interesa esta forma de pago para tus próximos pedidos.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className="card p-5 grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-xs text-muted mb-1">Saldo (deuda)</p>
          <p className="text-lg font-bold text-red-600 dark:text-red-400">{formatPrice(condiciones.saldo_cuenta_corriente)}</p>
        </div>
        <div>
          <p className="text-xs text-muted mb-1">Límite</p>
          <p className="text-lg font-bold">{formatPrice(condiciones.limite_cuenta_corriente)}</p>
        </div>
        <div>
          <p className="text-xs text-muted mb-1">Disponible</p>
          <p className="text-lg font-bold text-green-600 dark:text-green-400">{formatPrice(condiciones.disponible_cuenta_corriente)}</p>
        </div>
      </div>

      {/* Historial de movimientos */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Wallet size={16} /> Historial de movimientos</h3>
        {movimientos.length === 0 ? (
          <p className="text-sm text-muted">Todavía no tenés movimientos registrados en tu cuenta corriente.</p>
        ) : (
          <div className="divide-y divide-border">
            {movimientos.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-3 text-sm">
                <div className="flex items-center gap-3">
                  {m.tipo === 'pago'
                    ? <TrendingDown size={16} className="text-green-600 dark:text-green-400 shrink-0" />
                    : <TrendingUp size={16} className="text-red-600 dark:text-red-400 shrink-0" />}
                  <div>
                    <p className="font-medium">{m.concepto ?? (m.tipo === 'pago' ? 'Pago registrado' : 'Compra por cuenta corriente')}</p>
                    <p className="text-xs text-muted">{formatDate(m.created_at)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={m.tipo === 'pago' ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-red-600 dark:text-red-400 font-semibold'}>
                    {m.tipo === 'pago' ? '− ' : '+ '}{formatPrice(m.monto)}
                  </p>
                  <p className="text-xs text-muted">Saldo: {formatPrice(m.saldo_resultante)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
