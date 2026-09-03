'use client';
import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Save, AlertCircle, Package2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { ProductVariant } from '@/types';

interface Props {
  productId: string;
}

/**
 * Gestor de variantes talla × color con stock independiente.
 * Solo se muestra cuando el producto ya existe (tiene ID) y tiene
 * venta minorista habilitada. Cada fila = una combinación única.
 */
export function ProductVariantsManager({ productId }: Props) {
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Form para nueva variante
  const [newTalla, setNewTalla] = useState('');
  const [newColor, setNewColor] = useState('');
  const [newStock, setNewStock] = useState(0);
  const [adding,   setAdding]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/admin/products/${productId}/variants`);
      const json = await res.json();
      if (res.ok) setVariants(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!newTalla.trim() || !newColor.trim()) {
      toast.error('Completá talla y color');
      return;
    }
    setAdding(true);
    try {
      const res  = await fetch(`/api/admin/products/${productId}/variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ talla: newTalla.trim(), color: newColor.trim(), stock_unidades: newStock }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? 'Error al crear variante'); return; }
      setVariants((prev) => [...prev, json.data]);
      setNewTalla(''); setNewColor(''); setNewStock(0);
      toast.success('Variante agregada');
    } finally {
      setAdding(false);
    }
  };

  const handleUpdateStock = async (variantId: string, stock: number) => {
    setSavingId(variantId);
    try {
      const res = await fetch(`/api/admin/products/${productId}/variants`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: variantId, stock_unidades: stock }),
      });
      if (!res.ok) { const j = await res.json(); toast.error(j.error ?? 'Error al guardar'); return; }
      setVariants((prev) => prev.map((v) => v.id === variantId ? { ...v, stock_unidades: stock } : v));
      toast.success('Stock actualizado');
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (variantId: string) => {
    if (!confirm('¿Eliminar esta variante? Si ya tiene ventas registradas, se desactivará en vez de borrarse.')) return;
    const res  = await fetch(`/api/admin/products/${productId}/variants?variantId=${variantId}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) { toast.error(json.error ?? 'Error al eliminar'); return; }
    if (json.deactivated) {
      setVariants((prev) => prev.map((v) => v.id === variantId ? { ...v, activo: false } : v));
      toast.success('Variante desactivada (tenía ventas registradas)');
    } else {
      setVariants((prev) => prev.filter((v) => v.id !== variantId));
      toast.success('Variante eliminada');
    }
  };

  if (loading) {
    return <p className="text-xs text-muted py-2">Cargando variantes...</p>;
  }

  return (
    <div className="rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Package2 size={15} className="text-brand-500" />
        <p className="text-sm font-semibold">Variantes (talla / color)</p>
      </div>
      <p className="text-xs text-muted -mt-1">
        Cada combinación tiene su propio stock. Si no cargás ninguna variante,
        el producto usa el stock general de arriba.
      </p>

      {variants.length > 0 && (
        <div className="space-y-1.5">
          {variants.map((v) => (
            <div key={v.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${!v.activo ? 'opacity-40 border-border' : 'border-border'}`}>
              <span className="text-xs font-semibold w-16 shrink-0">{v.talla}</span>
              <span className="text-xs flex-1 truncate">{v.color}</span>
              <input
                type="number" min="0"
                defaultValue={v.stock_unidades}
                disabled={!v.activo || savingId === v.id}
                onBlur={(e) => {
                  const val = Number(e.target.value);
                  if (val !== v.stock_unidades) handleUpdateStock(v.id, val);
                }}
                className="input-base text-xs w-20 py-1"
              />
              {!v.activo && <span className="text-[10px] text-muted shrink-0">Inactiva</span>}
              <button onClick={() => handleDelete(v.id)} className="text-muted hover:text-red-500 shrink-0">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {variants.length === 0 && (
        <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 rounded-lg px-3 py-2">
          <AlertCircle size={13} />
          Sin variantes cargadas — se usa el stock general del producto.
        </div>
      )}

      <div className="flex gap-2 pt-2 border-t border-border">
        <input value={newTalla} onChange={(e) => setNewTalla(e.target.value)}
          placeholder="Talla (ej: M)" className="input-base text-xs w-24 py-1.5" />
        <input value={newColor} onChange={(e) => setNewColor(e.target.value)}
          placeholder="Color (ej: Azul)" className="input-base text-xs flex-1 py-1.5" />
        <input type="number" min="0" value={newStock}
          onChange={(e) => setNewStock(Number(e.target.value))}
          placeholder="Stock" className="input-base text-xs w-20 py-1.5" />
        <button onClick={handleAdd} disabled={adding} className="btn-secondary text-xs px-3 gap-1">
          <Plus size={13} /> Agregar
        </button>
      </div>
    </div>
  );
}
