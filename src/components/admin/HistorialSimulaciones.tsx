'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { History, RotateCcw, Trash2 } from 'lucide-react';
import { cn } from '@/utils';
import type { EntradaRentabilidad, Veredicto } from '@/lib/rentabilidad';

export interface SimulacionGuardada {
  id: string;
  nombre: string;
  product_id: string | null;
  precio_docena: number;
  docenas_compra: number;
  cotizacion_usd: number | null;
  cotizacion_origen: 'blue' | 'manual' | null;
  cotizacion_fecha: string | null;
  costo_real_docena: number;
  ganancia_docena: number;
  margen_pct: number;
  markup_pct: number;
  veredicto: Veredicto;
  notas: string | null;
  inputs: EntradaRentabilidad;
  created_at: string;
}

interface Props {
  /** Cambia cada vez que se guarda una simulación nueva, para recargar la lista. */
  version: number;
  onCargar: (sim: SimulacionGuardada) => void;
}

const ars = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(n);
const num2 = (n: number) =>
  new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const BADGE: Record<Veredicto, { texto: string; clase: string }> = {
  optimo: { texto: 'Rentable', clase: 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400' },
  bajo_objetivo: { texto: 'Bajo objetivo', clase: 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' },
  perdida: { texto: 'Pérdida', clase: 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400' },
};

/**
 * Historial de simulaciones guardadas. Muestra los valores tal como se
 * guardaron (con la cotización de ese momento): nunca se recalculan
 * cuando cambia el dólar.
 */
export function HistorialSimulaciones({ version, onCargar }: Props) {
  const [items, setItems] = useState<SimulacionGuardada[]>([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/costos/simulaciones');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setItems(json.data ?? []);
    } catch {
      toast.error('No se pudo cargar el historial');
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { cargar(); }, [cargar, version]);

  const borrar = async (id: string) => {
    if (!window.confirm('¿Borrar esta simulación del historial?')) return;
    try {
      const res = await fetch(`/api/admin/costos/simulaciones?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch {
      toast.error('No se pudo borrar');
    }
  };

  return (
    <div className="card p-4">
      <h2 className="mb-3 flex items-center gap-2 font-semibold">
        <History size={16} /> Historial de simulaciones
      </h2>

      {loading && <p className="text-sm text-muted">Cargando…</p>}
      {!loading && items.length === 0 && (
        <p className="text-sm text-muted">Todavía no guardaste ninguna simulación.</p>
      )}

      <div className="space-y-3">
        {items.map((s) => (
          <div key={s.id} className="rounded-lg border border-border p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="break-words font-medium">{s.nombre}</p>
                <p className="text-xs text-muted">{new Date(s.created_at).toLocaleString('es-AR')}</p>
              </div>
              <span className={cn('badge shrink-0', BADGE[s.veredicto].clase)}>{BADGE[s.veredicto].texto}</span>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <span className="text-muted">Precio/docena</span><span className="text-right">{ars(s.precio_docena)}</span>
              <span className="text-muted">Costo real/docena</span><span className="text-right">{ars(s.costo_real_docena)}</span>
              <span className="text-muted">Ganancia/docena</span><span className="text-right font-semibold">{ars(s.ganancia_docena)}</span>
              <span className="text-muted">Margen / Markup</span>
              <span className="text-right">{num2(s.margen_pct)} % / {num2(s.markup_pct)} %</span>
              <span className="text-muted">Docenas de la compra</span><span className="text-right">{num2(s.docenas_compra)}</span>
              {s.cotizacion_usd !== null && (
                <>
                  <span className="text-muted">Dólar usado</span>
                  <span className="text-right">
                    {ars(s.cotizacion_usd)} ({s.cotizacion_origen === 'manual' ? 'manual' : 'blue venta'})
                  </span>
                </>
              )}
            </div>

            {s.notas && <p className="mt-2 text-xs text-muted">📝 {s.notas}</p>}

            <div className="mt-2 flex gap-2">
              <button onClick={() => onCargar(s)} className="btn-ghost py-1 text-xs">
                <RotateCcw size={13} /> Cargar en la calculadora
              </button>
              <button onClick={() => borrar(s.id)} className="btn-ghost py-1 text-xs text-red-600">
                <Trash2 size={13} /> Borrar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}