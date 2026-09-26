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
  const [nuevoTipo, setNuevoTipo] = useState<'fijo' | 'por_dia'>('fijo');
  const [nuevoMonto, setNuevoMonto] = useState('');
  const [nuevoDias, setNuevoDias] = useState('');
  const [nuevoPagoDia, setNuevoPagoDia] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Ediciones en curso de días/pago por día de gastos ya cargados,
  // indexadas por id — así cada fila puede tener su propio borrador sin
  // pisar a las demás mientras el admin escribe.
  const [edicionPorDia, setEdicionPorDia] = useState<Record<string, { dias: string; pago: string }>>({});

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
    if (!nuevoNombre.trim()) {
      toast.error('Completá el nombre del gasto');
      return;
    }
    let body: Record<string, unknown>;
    if (nuevoTipo === 'por_dia') {
      const dias = Number(nuevoDias);
      const pago = Number(nuevoPagoDia);
      if (Number.isNaN(dias) || dias <= 0 || Number.isNaN(pago) || pago < 0) {
        toast.error('Completá días trabajados (> 0) y pago por día (>= 0)');
        return;
      }
      body = { nombre: nuevoNombre.trim(), tipo: 'por_dia', dias_mes: dias, pago_por_dia: pago };
    } else {
      const monto = Number(nuevoMonto);
      if (Number.isNaN(monto) || monto < 0) {
        toast.error('Completá un monto mensual válido (>= 0)');
        return;
      }
      body = { nombre: nuevoNombre.trim(), tipo: 'fijo', monto_mensual: monto };
    }
    try {
      const res = await fetch('/api/admin/costos/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setSettings([...settings, json.data]);
      setNuevoNombre('');
      setNuevoMonto('');
      setNuevoDias('');
      setNuevoPagoDia('');
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

  // Guarda días trabajados y/o pago por día de un gasto tipo 'por_dia' ya
  // cargado. El monto_mensual se recalcula solo del lado del servidor.
  const guardarPorDia = async (s: CostSetting) => {
    const borrador = edicionPorDia[s.id];
    if (!borrador) return;
    const dias = Number(borrador.dias);
    const pago = Number(borrador.pago);
    if (Number.isNaN(dias) || dias <= 0 || Number.isNaN(pago) || pago < 0) {
      toast.error('Días (> 0) y pago por día (>= 0) tienen que ser válidos');
      return;
    }
    try {
      const res = await fetch('/api/admin/costos/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: s.id, dias_mes: dias, pago_por_dia: pago }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setSettings(settings.map((x) => (x.id === s.id ? json.data : x)));
      setEdicionPorDia((prev) => {
        const resto = { ...prev };
        delete resto[s.id];
        return resto;
      });
    } catch {
      toast.error('No se pudo actualizar el gasto por día');
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
              <p className="text-sm font-medium">Gastos fijos mensuales (alquiler, despensas, sueldo del empleado, etc.)</p>
              <div className="space-y-1.5">
                {settings.length === 0 && <p className="text-xs text-muted">Todavía no cargaste ningún gasto fijo.</p>}
                {settings.map((s) => {
                  const borrador = edicionPorDia[s.id];
                  const hayCambios = borrador && (
                    Number(borrador.dias) !== Number(s.dias_mes) || Number(borrador.pago) !== Number(s.pago_por_dia)
                  );
                  return (
                    <div key={s.id} className="rounded-xl border border-border px-3 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={s.activo} onChange={() => toggleActivo(s)} className="shrink-0 accent-brand-500" />
                        <span className={cn('min-w-0 flex-1 truncate', !s.activo && 'text-muted line-through')}>{s.nombre}</span>
                        <span className="shrink-0 font-medium">{formatPrice(s.monto_mensual)}</span>
                        <button onClick={() => borrarGasto(s.id)} className="shrink-0 text-red-500 hover:text-red-600">
                          <Trash2 size={14} />
                        </button>
                      </div>
                      {s.tipo === 'por_dia' && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-6 text-xs text-muted">
                          <input
                            type="number" min={0} step="1" placeholder="Días/mes"
                            value={borrador?.dias ?? String(s.dias_mes ?? '')}
                            onChange={(e) => setEdicionPorDia((prev) => ({
                              ...prev,
                              [s.id]: { dias: e.target.value, pago: prev[s.id]?.pago ?? String(s.pago_por_dia ?? '') },
                            }))}
                            className="input-base w-20 py-1 text-xs"
                          />
                          <span>días ×</span>
                          <input
                            type="number" min={0} step="0.01" placeholder="Pago/día"
                            value={borrador?.pago ?? String(s.pago_por_dia ?? '')}
                            onChange={(e) => setEdicionPorDia((prev) => ({
                              ...prev,
                              [s.id]: { pago: e.target.value, dias: prev[s.id]?.dias ?? String(s.dias_mes ?? '') },
                            }))}
                            className="input-base w-24 py-1 text-xs"
                          />
                          <span>/día</span>
                          {hayCambios && (
                            <button onClick={() => guardarPorDia(s)} className="btn-ghost py-0.5 text-xs text-brand-600">
                              Actualizar
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                <button
                  onClick={() => { setNuevoNombre('Alquiler local'); setNuevoTipo('fijo'); }}
                  className="btn-ghost px-2 py-1 text-xs"
                >
                  + Alquiler
                </button>
                <button
                  onClick={() => { setNuevoNombre('Despensas'); setNuevoTipo('fijo'); }}
                  className="btn-ghost px-2 py-1 text-xs"
                >
                  + Despensas
                </button>
                <button
                  onClick={() => { setNuevoNombre('Empleado'); setNuevoTipo('por_dia'); }}
                  className="btn-ghost px-2 py-1 text-xs"
                >
                  + Empleado (por día)
                </button>
              </div>

              <div className="space-y-2 rounded-xl border border-dashed border-border p-3">
                <div className="flex flex-wrap gap-2">
                  <input
                    placeholder="Nombre (ej. Alquiler local)"
                    value={nuevoNombre}
                    onChange={(e) => setNuevoNombre(e.target.value)}
                    className="input-base min-w-[140px] flex-1 py-1.5 text-sm"
                  />
                  <select
                    value={nuevoTipo}
                    onChange={(e) => setNuevoTipo(e.target.value as 'fijo' | 'por_dia')}
                    className="input-base py-1.5 text-sm"
                  >
                    <option value="fijo">Monto fijo por mes</option>
                    <option value="por_dia">Se paga por día trabajado</option>
                  </select>
                </div>

                {nuevoTipo === 'fijo' ? (
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="number" min={0} step="0.01" placeholder="Monto/mes"
                      value={nuevoMonto}
                      onChange={(e) => setNuevoMonto(e.target.value)}
                      className="input-base w-full py-1.5 text-sm sm:w-32"
                    />
                    <button onClick={agregarGasto} className="btn-ghost px-2"><Plus size={16} /></button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="number" min={0} step="1" placeholder="Días trabajados en el mes"
                      value={nuevoDias}
                      onChange={(e) => setNuevoDias(e.target.value)}
                      className="input-base w-full py-1.5 text-sm sm:w-40"
                    />
                    <span className="text-xs text-muted">×</span>
                    <input
                      type="number" min={0} step="0.01" placeholder="Pago por día"
                      value={nuevoPagoDia}
                      onChange={(e) => setNuevoPagoDia(e.target.value)}
                      className="input-base w-full py-1.5 text-sm sm:w-32"
                    />
                    <button onClick={agregarGasto} className="btn-ghost px-2"><Plus size={16} /></button>
                    {Number(nuevoDias) > 0 && Number(nuevoPagoDia) >= 0 && !Number.isNaN(Number(nuevoDias)) && !Number.isNaN(Number(nuevoPagoDia)) && (
                      <span className="w-full text-xs text-muted sm:w-auto">
                        = {formatPrice(Number(nuevoDias) * Number(nuevoPagoDia))}/mes
                      </span>
                    )}
                  </div>
                )}
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