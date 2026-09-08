'use client';
import { useState } from 'react';
import { Star, Check, Trash2, Clock } from 'lucide-react';
import { formatDate } from '@/utils';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

interface ReviewRow {
  id: string; product_id: string; nombre_cliente: string;
  rating: number; comentario: string; aprobado: boolean; created_at: string;
  products?: { nombre: string; slug: string } | null;
}

function Stars({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={13} className={n <= value ? 'fill-amber-400 text-amber-400' : 'text-border'} />
      ))}
    </div>
  );
}

export function AdminReviewsClient({ initialReviews }: { initialReviews: ReviewRow[] }) {
  const [reviews, setReviews] = useState<ReviewRow[]>(initialReviews);
  const [tab, setTab] = useState<'pendientes' | 'aprobadas'>('pendientes');
  const supabase = createClient();

  const aprobar = async (id: string) => {
    const { error } = await supabase.from('product_reviews').update({ aprobado: true }).eq('id', id);
    if (error) { toast.error('Error al aprobar'); return; }
    setReviews((prev) => prev.map((r) => r.id === id ? { ...r, aprobado: true } : r));
    toast.success('Reseña aprobada — ya es pública');
  };

  const rechazar = async (id: string) => {
    if (!confirm('¿Eliminar esta reseña? No se puede deshacer.')) return;
    const { error } = await supabase.from('product_reviews').delete().eq('id', id);
    if (error) { toast.error('Error al eliminar'); return; }
    setReviews((prev) => prev.filter((r) => r.id !== id));
    toast.success('Reseña eliminada');
  };

  const pendientes = reviews.filter((r) => !r.aprobado);
  const aprobadas  = reviews.filter((r) => r.aprobado);
  const visibles   = tab === 'pendientes' ? pendientes : aprobadas;

  return (
    <div>
      <div className="flex gap-1 border-b border-border mb-6 overflow-x-auto">
        <button
          onClick={() => setTab('pendientes')}
          className={`shrink-0 flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'pendientes' ? 'border-brand-600 text-brand-600' : 'border-transparent text-muted hover:text-foreground'
          }`}
        >
          <Clock size={14} /> Pendientes {pendientes.length > 0 && <span className="badge bg-amber-100 text-amber-700">{pendientes.length}</span>}
        </button>
        <button
          onClick={() => setTab('aprobadas')}
          className={`shrink-0 flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'aprobadas' ? 'border-brand-600 text-brand-600' : 'border-transparent text-muted hover:text-foreground'
          }`}
        >
          <Check size={14} /> Aprobadas ({aprobadas.length})
        </button>
      </div>

      <div className="space-y-3">
        {visibles.map((r) => (
          <div key={r.id} className="card p-4">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{r.nombre_cliente}</p>
                <p className="text-xs text-muted truncate">{r.products?.nombre ?? 'Producto eliminado'}</p>
              </div>
              <span className="text-xs text-muted shrink-0">{formatDate(r.created_at)}</span>
            </div>
            <Stars value={r.rating} />
            <p className="text-sm text-muted mt-2 leading-relaxed">{r.comentario}</p>
            <div className="flex gap-2 mt-3">
              {!r.aprobado && (
                <button onClick={() => aprobar(r.id)} className="btn-primary py-1.5 px-3 text-xs gap-1.5">
                  <Check size={13} /> Aprobar
                </button>
              )}
              <button onClick={() => rechazar(r.id)} className="btn-ghost py-1.5 px-3 text-xs gap-1.5 text-red-500 hover:bg-red-50">
                <Trash2 size={13} /> Eliminar
              </button>
            </div>
          </div>
        ))}

        {visibles.length === 0 && (
          <div className="card p-12 text-center text-muted">
            <Star size={40} className="mx-auto mb-3 opacity-20" />
            <p>{tab === 'pendientes' ? 'No hay reseñas pendientes de moderación.' : 'Todavía no hay reseñas aprobadas.'}</p>
          </div>
        )}
      </div>
    </div>
  );
}