'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';
import { formatPrice } from '@/utils';
import { calcularCostoTotalDocena, type CostReportRow } from '@/lib/costos';

interface Props {
  row: CostReportRow;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Todos los campos son SIEMPRE por docena (bulto), no por unidad —
 * se repite en cada label a propósito para que quede inequívoco al
 * cargar el dato, que es la parte más propensa a error humano.
 */
export function ProductCostForm({ row, onClose, onSaved }: Props) {
  const [compra, setCompra] = useState(String(row.costo_compra_docena));
  const [transporte, setTransporte] = useState(String(row.transporte_docena));
  const [empaque, setEmpaque] = useState(String(row.empaque_docena));
  const [otros, setOtros] = useState(String(row.otros_docena));
  const [saving, setSaving] = useState(false);

  const num = (v: string) => (v === '' ? 0 : Number(v));

  const previewTotal = calcularCostoTotalDocena(
    {
      product_id: row.product_id,
      nombre: row.nombre,
      precio_docena_actual: row.precio_docena_actual,
      costo_compra_docena: num(compra),
      transporte_docena: num(transporte),
      empaque_docena: num(empaque),
      otros_docena: num(otros),
    },
    row.gastos_fijos_prorrateados_docena
  ).costo_total_docena;

  const guardar = async () => {
    const valores = { compra: num(compra), transporte: num(transporte), empaque: num(empaque), otros: num(otros) };
    if (Object.values(valores).some((v) => v < 0 || Number.isNaN(v))) {
      toast.error('Los montos no pueden ser negativos');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/costos/product', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: row.product_id,
          costo_compra_docena: valores.compra,
          transporte_docena: valores.transporte,
          empaque_docena: valores.empaque,
          otros_docena: valores.otros,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success('Costo actualizado');
      onSaved();
    } catch {
      toast.error('No se pudo guardar el costo');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-2xl bg-surface shadow-2xl animate-scale-in">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="font-semibold">Costo por docena — {row.nombre}</h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={18} /></button>
        </div>

        <div className="space-y-4 p-6">
          <p className="text-xs text-muted">
            Todos los montos son por docena (bulto), no por unidad individual.
          </p>

          <Campo label="Precio de compra / docena" value={compra} onChange={setCompra} />
          <Campo label="Transporte prorrateado / docena" value={transporte} onChange={setTransporte} />
          <Campo label="Empaque / lona / docena" value={empaque} onChange={setEmpaque} />
          <Campo label="Otros costos / docena" value={otros} onChange={setOtros} />

          <div className="rounded-xl bg-surface-2 p-3 text-sm">
            <div className="flex justify-between text-muted">
              <span>+ Gastos fijos prorrateados</span>
              <span>{formatPrice(row.gastos_fijos_prorrateados_docena)}</span>
            </div>
            <div className="mt-1 flex justify-between border-t border-border pt-1 font-semibold">
              <span>Costo Total / Docena</span>
              <span className="text-brand-600">{formatPrice(previewTotal)}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={guardar} disabled={saving} className="btn-primary">
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Campo({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted">{label}</label>
      <input
        type="number"
        min={0}
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-base"
      />
    </div>
  );
}