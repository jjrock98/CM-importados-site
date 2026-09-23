'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { X, Plus, Trash2 } from 'lucide-react';
import { formatPrice, cn } from '@/utils';
import type { CostSetting } from '@/types';

interface Props {
  periodo: string;
  onClose: () => void;
  onSaved: () => void;
}

export function CostSettingsForm({ periodo, onClose, onSaved }: Props) {
  const [settings, setSettings] = useState<CostSetting[]>([]);
  const [docenasEstimadas, setDocenasEstimadas] = useState('');
  const [docenasSugeridas, setDocenasSugeridas] = useState<number | null>(null);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoMonto, setNuevoMonto] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const cargar = async () => {
    setLoading(true);
    try {
      const [resSettings, resPeriod] = await Promise.all([
        fetch('/api/admin/costos/settings'),
        fetch(`/api/admin/costos/period?periodo=${periodo}`),
      ]);
      const [jsonSettings, jsonPeriod] = await Promise.all([resSettings.json(), resPeriod.json()]);
      setSettings(jsonSettings.data ?? []);
      setDocenasEstimadas(String(jsonPeriod.docenas_estimadas || ''));
      setDocenasSugeridas(jsonPeriod.docenas_sugeridas ?? null);
    } catch {
      toast.error('No se pudieron cargar los gastos fijos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const totalActivos = settings.filter((s) => s.activo).reduce((acc, s) => acc + Number(s.monto_mensual), 0);

  const agregarGasto = async () => {
    const monto = Number(nuevoMonto);
    if (!nuevoNombre.trim() || Number.isNaN(monto) || monto < 0) {
      toast.error('Completá nombre y monto mensual (>= 0)');
      return;
    }
    try {
      const res = await fetch('/api/admin/costos/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nuevoNombre.trim(), monto_mensual: monto }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setSettings([...settings, json.data]);
      setNuevoNombre('');
      setNuevoMonto('');
    } catch {
      toast.error('No se pudo agregar el gasto fijo');
    }
  };

  const toggleActivo = async (s: CostSetting) => {
    const activo = !s.activo;
    setSettings(settings.map((x) => (x.id === s.id ? { ...x, activo } : x)));
    try {
      await fetch('/api/admin/costos/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: s.id, activo }),
      });
    } catch {
      toast.error('No se pudo actualizar');
    }
  };

  const borrarGasto = async (id: string) => {
    const anterior = settings;
    setSettings(settings.filter((s) => s.id !== id));
    try {
      const res = await fetch(`/api/admin/costos/settings?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
    } catch {
      setSettings(anterior);
      toast.error('No se pudo borrar el gasto fijo');
    }
  };

  const guardarPeriodo = async () => {
    const n = Number(docenasEstimadas);
    if (docenasEstimadas === '' || Number.isNaN(n) || n < 0) {
      toast.error('Ingresá una cantidad de docenas válida');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/costos/period', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodo, docenas_estimadas: n }),
      });
      if (!res.ok) throw new Error();
      toast.success('Configuración del período guardada');
      onSaved();
    } catch {
      toast.error('No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-surface shadow-2xl animate-scale-in">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="font-semibold">Gastos fijos y prorrateo — {periodo}</h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={18} /></button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-muted">Cargando…</div>
        ) : (
          <div className="space-y-6 p-6">
            <section className="space-y-2">
              <p className="text-sm font-medium">Gastos fijos mensuales (alquiler, sueldo ayudante, etc.)</p>
              <div className="space-y-1.5">
                {settings.length === 0 && <p className="text-xs text-muted">Todavía no cargaste ningún gasto fijo.</p>}
                {settings.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm">
                    <input type="checkbox" checked={s.activo} onChange={() => toggleActivo(s)} className="shrink-0 accent-brand-500" />
                    <span className={cn('min-w-0 flex-1 truncate', !s.activo && 'text-muted line-through')}>{s.nombre}</span>
                    <span className="shrink-0 font-medium">{formatPrice(s.monto_mensual)}</span>
                    <button onClick={() => borrarGasto(s.id)} className="shrink-0 text-red-500 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <input
                  placeholder="Nombre (ej. Alquiler local)"
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  className="input-base min-w-[140px] flex-1 py-1.5 text-sm"
                />
                <input
                  type="number" min={0} step="0.01" placeholder="Monto/mes"
                  value={nuevoMonto}
                  onChange={(e) => setNuevoMonto(e.target.value)}
                  className="input-base w-full py-1.5 text-sm sm:w-28"
                />
                <button onClick={agregarGasto} className="btn-ghost px-2"><Plus size={16} /></button>
              </div>

              <p className="text-xs text-muted pt-1">
                Total gastos fijos activos: <strong>{formatPrice(totalActivos)}</strong>
              </p>
            </section>

            <section className="space-y-2 border-t border-border pt-4">
              <p className="text-sm font-medium">Docenas estimadas del período (divisor del prorrateo)</p>
              <p className="text-xs text-muted">
                Es una proyección tuya de cuántas docenas pensás mover en {periodo} — vos decidís el número.
                {docenasSugeridas !== null && docenasSugeridas > 0 && (
                  <> Referencia: se vendieron <strong>{docenasSugeridas}</strong> docenas equivalentes el mes anterior.</>
                )}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="number" min={0} step="0.01"
                  value={docenasEstimadas}
                  onChange={(e) => setDocenasEstimadas(e.target.value)}
                  className="input-base w-40"
                />
                {docenasSugeridas !== null && docenasSugeridas > 0 && (
                  <button
                    onClick={() => setDocenasEstimadas(String(docenasSugeridas))}
                    className="btn-ghost whitespace-normal text-left text-xs py-1.5"
                  >
                    Usar sugerido ({docenasSugeridas})
                  </button>
                )}
              </div>
            </section>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
          <button onClick={onClose} className="btn-secondary">Cerrar</button>
          <button onClick={guardarPeriodo} disabled={saving || loading} className="btn-primary">
            {saving ? 'Guardando…' : 'Guardar período'}
          </button>
        </div>
      </div>
    </div>
  );
}