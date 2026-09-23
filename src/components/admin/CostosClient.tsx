'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Download, FileSpreadsheet, FileText, FileDown, Pencil, Settings2, RefreshCw } from 'lucide-react';
import { formatPrice, cn } from '@/utils';
import { simularMargen, MARGENES_DEFAULT, type CostReportRow } from '@/lib/costos';
import { ProductCostForm } from './ProductCostForm';
import { CostSettingsForm } from './CostSettingsForm';

interface ReporteResponse {
  periodo: string;
  total_gastos_fijos_mensuales: number;
  docenas_estimadas: number;
  gastos_fijos_por_docena: number;
  rows: CostReportRow[];
}

function periodoActual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function CostosClient() {
  const [periodo, setPeriodo] = useState(periodoActual());
  const [data, setData] = useState<ReporteResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [margenes, setMargenes] = useState<number[]>(MARGENES_DEFAULT);
  const [margenCustom, setMargenCustom] = useState('');
  const [editingProduct, setEditingProduct] = useState<CostReportRow | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'excel' | 'csv' | null>(null);

  const cargarReporte = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/costos?periodo=${periodo}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setData(json);
    } catch {
      toast.error('No se pudo cargar el reporte de costos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargarReporte(); }, [periodo]); // eslint-disable-line react-hooks/exhaustive-deps

  const agregarMargenCustom = () => {
    const n = Number(margenCustom);
    if (!margenCustom || Number.isNaN(n) || n < 0) {
      toast.error('Ingresá un % de margen válido');
      return;
    }
    if (margenes.includes(n)) { setMargenCustom(''); return; }
    setMargenes([...margenes, n].sort((a, b) => a - b));
    setMargenCustom('');
  };

  const quitarMargen = (m: number) => setMargenes(margenes.filter((x) => x !== m));

  const exportar = async (tipo: 'pdf' | 'excel' | 'csv') => {
    setExporting(tipo);
    try {
      const res = await fetch(`/api/admin/costos/export/${tipo}?periodo=${periodo}&margenes=${margenes.join(',')}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = tipo === 'pdf' ? 'pdf' : tipo === 'excel' ? 'xlsx' : 'csv';
      a.download = `costos-por-docena-${periodo}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      const label = tipo === 'pdf' ? 'PDF' : tipo === 'excel' ? 'Excel' : 'CSV';
      toast.error(`No se pudo generar el ${label}`);
    } finally {
      setExporting(null);
    }
  };

  const totalCostoPromedio = useMemo(() => {
    if (!data?.rows.length) return 0;
    return data.rows.reduce((acc, r) => acc + r.costo_total_docena, 0) / data.rows.length;
  }, [data]);

  const filaSinCosto = (row: CostReportRow) =>
    row.costo_compra_docena === 0 && row.transporte_docena === 0 &&
    row.empaque_docena === 0 && row.otros_docena === 0;

  return (
    <div className="space-y-5">
      {/* Barra de controles */}
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted">Período</label>
          <input
            type="month"
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            className="input-base w-auto py-1.5"
          />
        </div>

        <button onClick={cargarReporte} className="btn-ghost" title="Recalcular">
          <RefreshCw size={15} className={cn(loading && 'animate-spin')} />
          Recalcular
        </button>

        <button onClick={() => setShowSettings(true)} className="btn-secondary sm:ml-auto">
          <Settings2 size={16} />
          <span className="hidden sm:inline">Gastos fijos y docenas estimadas</span>
          <span className="sm:hidden">Parámetros</span>
        </button>

        <button onClick={() => exportar('pdf')} disabled={exporting !== null} className="btn-secondary">
          <FileText size={16} /> {exporting === 'pdf' ? 'Generando…' : 'PDF'}
        </button>
        <button onClick={() => exportar('csv')} disabled={exporting !== null} className="btn-secondary">
          <FileDown size={16} /> {exporting === 'csv' ? 'Generando…' : 'CSV'}
        </button>
        <button onClick={() => exportar('excel')} disabled={exporting !== null} className="btn-primary">
          <FileSpreadsheet size={16} /> {exporting === 'excel' ? 'Generando…' : 'Excel'}
        </button>
      </div>

      {/* Resumen del prorrateo */}
      {data && (
        <div className="card grid grid-cols-1 gap-3 p-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-muted">Gastos fijos del período</p>
            <p className="font-semibold">{formatPrice(data.total_gastos_fijos_mensuales)}</p>
          </div>
          <div>
            <p className="text-muted">Docenas estimadas (divisor)</p>
            <p className="font-semibold">{data.docenas_estimadas || '— sin cargar'}</p>
          </div>
          <div>
            <p className="text-muted">Prorrateado por docena</p>
            <p className="font-semibold text-brand-600">{formatPrice(data.gastos_fijos_por_docena)}</p>
          </div>
        </div>
      )}

      {/* Simulador de márgenes: chips editables */}
      <div className="card flex flex-wrap items-center gap-2 p-4">
        <span className="text-sm font-medium">Márgenes a simular:</span>
        {margenes.map((m) => (
          <span key={m} className="badge bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:text-brand-400 gap-1">
            {m}%
            <button onClick={() => quitarMargen(m)} className="ml-1 opacity-60 hover:opacity-100">×</button>
          </span>
        ))}
        <input
          type="number"
          min={0}
          placeholder="+ % custom"
          value={margenCustom}
          onChange={(e) => setMargenCustom(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && agregarMargenCustom()}
          className="input-base w-28 py-1"
        />
        <button onClick={agregarMargenCustom} className="btn-ghost py-1">Agregar</button>
      </div>

      {/* Tabla del reporte — desktop (md+): tabla completa, con scroll horizontal
          de respaldo si se agregan muchos márgenes custom. */}
      <div className="card hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-2 text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Producto</th>
                <th className="px-3 py-3 text-right">Costo Total/Doc</th>
                <th className="px-3 py-3 text-right">Precio actual</th>
                {margenes.map((m) => (
                  <th key={m} className="px-3 py-3 text-right whitespace-nowrap">Sugerido {m}%</th>
                ))}
                <th className="px-3 py-3 text-center">Editar</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={4 + margenes.length} className="px-4 py-8 text-center text-muted">Calculando…</td></tr>
              )}
              {!loading && data?.rows.length === 0 && (
                <tr><td colSpan={4 + margenes.length} className="px-4 py-8 text-center text-muted">No hay productos activos.</td></tr>
              )}
              {!loading && data?.rows.map((row) => {
                const sinCostoCargado = filaSinCosto(row);
                return (
                  <tr key={row.product_id} className="border-b border-border last:border-0 hover:bg-surface-2/50">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {row.nombre}
                        {sinCostoCargado && (
                          <span className="badge bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 whitespace-nowrap">
                            Sin costo cargado
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-brand-600 whitespace-nowrap">
                      {formatPrice(row.costo_total_docena)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-muted whitespace-nowrap">{formatPrice(row.precio_docena_actual)}</td>
                    {margenes.map((m) => {
                      const sim = simularMargen(row.costo_total_docena, m);
                      return (
                        <td key={m} className="px-3 py-2.5 text-right text-green-700 dark:text-green-400 whitespace-nowrap">
                          {formatPrice(sim.precio_sugerido_docena)}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2.5 text-center">
                      <button onClick={() => setEditingProduct(row)} className="btn-ghost p-1.5" title="Editar costos">
                        <Pencil size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {!loading && data && data.rows.length > 0 && (
              <tfoot>
                <tr className="border-t border-border bg-surface-2 text-xs text-muted">
                  <td className="px-4 py-2" colSpan={2}>
                    Costo total/doc. promedio: <strong>{formatPrice(totalCostoPromedio)}</strong>
                  </td>
                  <td colSpan={margenes.length + 2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Mismo reporte — mobile (< md): lista de tarjetas en vez de tabla.
          Con los márgenes custom la cantidad de columnas no tiene techo,
          así que en pantallas chicas se muestran como chips que se
          acomodan solos en vez de forzar scroll horizontal. */}
      <div className="space-y-3 md:hidden">
        {loading && <div className="card p-8 text-center text-sm text-muted">Calculando…</div>}
        {!loading && data?.rows.length === 0 && (
          <div className="card p-8 text-center text-sm text-muted">No hay productos activos.</div>
        )}
        {!loading && data?.rows.map((row) => {
          const sinCostoCargado = filaSinCosto(row);
          return (
            <div key={row.product_id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium break-words">{row.nombre}</p>
                  {sinCostoCargado && (
                    <span className="badge mt-1 bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                      Sin costo cargado
                    </span>
                  )}
                </div>
                <button onClick={() => setEditingProduct(row)} className="btn-ghost shrink-0 p-1.5" title="Editar costos">
                  <Pencil size={14} />
                </button>
              </div>

              <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
                <span className="text-muted">
                  Costo/Doc: <strong className="text-brand-600">{formatPrice(row.costo_total_docena)}</strong>
                </span>
                <span className="text-muted">
                  Actual: {formatPrice(row.precio_docena_actual)}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {margenes.map((m) => {
                  const sim = simularMargen(row.costo_total_docena, m);
                  return (
                    <span key={m} className="badge bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400">
                      {m}%: {formatPrice(sim.precio_sugerido_docena)}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
        {!loading && data && data.rows.length > 0 && (
          <p className="px-1 text-xs text-muted">
            Costo total/doc. promedio: <strong>{formatPrice(totalCostoPromedio)}</strong>
          </p>
        )}
      </div>

      <p className="flex items-center gap-2 text-xs text-muted">
        <Download size={12} />
        Los precios sugeridos son solo una simulación: no se aplican al catálogo hasta que edites el producto manualmente en Productos.
      </p>

      {editingProduct && (
        <ProductCostForm
          row={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSaved={() => { setEditingProduct(null); cargarReporte(); }}
        />
      )}

      {showSettings && (
        <CostSettingsForm
          periodo={periodo}
          onClose={() => setShowSettings(false)}
          onSaved={() => { setShowSettings(false); cargarReporte(); }}
        />
      )}
    </div>
  );
}