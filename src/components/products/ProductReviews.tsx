'use client';
import { useState, useEffect, useCallback } from 'react';
import { Star, MessageSquareText, CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { formatDate, cn } from '@/utils';
import type { ProductReview } from '@/types';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface Props {
  productId: string;
  /** Reseñas ya aprobadas, traídas server-side (así aparecen en el HTML
   *  inicial para SEO — Google necesita ver el contenido, no solo el
   *  JSON-LD, para tomar en serio el rich snippet de reseñas). */
  initialReviews: ProductReview[];
}

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${value} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          className={n <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-border'}
        />
      ))}
    </div>
  );
}

export function ProductReviews({ productId, initialReviews }: Props) {
  const { user, profile, supabase, loading: authLoading } = useAuth();
  const [reviews] = useState<ProductReview[]>(initialReviews);
  const [myReview, setMyReview] = useState<ProductReview | null>(null);
  const [canReview, setCanReview] = useState(false);
  const [checking, setChecking] = useState(true);

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comentario, setComentario] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const checkEligibility = useCallback(async () => {
    if (!user) { setChecking(false); return; }

    // ¿Ya dejó una reseña (aprobada o pendiente)?
    const { data: existing } = await supabase
      .from('product_reviews')
      .select('*')
      .eq('product_id', productId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      setMyReview(existing as ProductReview);
      setChecking(false);
      return;
    }

    // ¿Tiene un pedido ENTREGADO que incluya este producto? (esto es solo
    // para decidir si mostramos el formulario — la garantía real de que
    // no pueda hacer trampa la pone la policy de INSERT en la base).
    const { data: orderItem } = await supabase
      .from('order_items')
      .select('id, orders!inner(estado, user_id)')
      .eq('product_id', productId)
      .eq('orders.user_id', user.id)
      .eq('orders.estado', 'entregado')
      .limit(1)
      .maybeSingle();

    setCanReview(!!orderItem);
    setChecking(false);
  }, [user, productId, supabase]);

  useEffect(() => {
    if (!authLoading) checkEligibility();
  }, [authLoading, checkEligibility]);

  const handleSubmit = async () => {
    if (!user || !profile) return;
    if (rating < 1) { toast.error('Elegí una calificación de 1 a 5 estrellas'); return; }
    if (comentario.trim().length < 10) { toast.error('Contanos un poco más (mínimo 10 caracteres)'); return; }

    setSubmitting(true);
    const { data, error } = await supabase
      .from('product_reviews')
      .insert({
        product_id: productId,
        user_id: user.id,
        nombre_cliente: profile.nombre ?? 'Cliente',
        rating,
        comentario: comentario.trim(),
      })
      .select('*')
      .single();
    setSubmitting(false);

    if (error) {
      toast.error('No se pudo enviar la reseña. ¿Tenés un pedido entregado de este producto?');
      return;
    }
    setMyReview(data as ProductReview);
    toast.success('¡Gracias! Tu reseña quedó pendiente de aprobación.');
  };

  const promedio = reviews.length
    ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length
    : 0;

  return (
    <section className="mt-12 border-t border-border pt-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-xl font-bold">Reseñas de clientes</h2>
        {reviews.length > 0 && (
          <div className="flex items-center gap-2">
            <Stars value={promedio} />
            <span className="text-sm text-muted">
              {promedio.toFixed(1)} · {reviews.length} reseña{reviews.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* ── Lista de reseñas aprobadas ── */}
      {reviews.length === 0 ? (
        <p className="text-sm text-muted mb-8">Todavía no hay reseñas para este producto.</p>
      ) : (
        <div className="space-y-4 mb-8">
          {reviews.map((r) => (
            <div key={r.id} className="card p-4">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-sm font-semibold">{r.nombre_cliente}</p>
                <span className="text-xs text-muted">{formatDate(r.created_at)}</span>
              </div>
              <Stars value={r.rating} size={14} />
              <p className="text-sm text-muted mt-2 leading-relaxed">{r.comentario}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Formulario / estado del usuario actual ── */}
      {checking || authLoading ? null : !user ? (
        <div className="card p-4 text-sm text-muted flex items-center gap-2">
          <MessageSquareText size={16} className="shrink-0" />
          <span>
            <Link href="/auth/login" className="text-brand-600 font-medium hover:underline">Iniciá sesión</Link>
            {' '}para dejar tu reseña (solo clientes con una compra entregada de este producto).
          </span>
        </div>
      ) : myReview ? (
        <div className="card p-4 text-sm flex items-center gap-2">
          <CheckCircle2 size={16} className={myReview.aprobado ? 'text-green-500' : 'text-amber-500'} />
          {myReview.aprobado
            ? <span>Ya dejaste tu reseña para este producto. ¡Gracias!</span>
            : <span>Tu reseña está pendiente de aprobación.</span>}
        </div>
      ) : canReview ? (
        <div className="card p-5">
          <p className="text-sm font-semibold mb-3">Dejá tu reseña</p>
          <div className="mb-3">
            <div className="flex gap-1" onMouseLeave={() => setHoverRating(0)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHoverRating(n)}
                  aria-label={`${n} estrellas`}
                  className="p-0.5"
                >
                  <Star
                    size={26}
                    className={cn(
                      n <= (hoverRating || rating) ? 'fill-amber-400 text-amber-400' : 'text-border',
                      'transition-colors'
                    )}
                  />
                </button>
              ))}
            </div>
          </div>
          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="Contanos qué te pareció el producto…"
            rows={3}
            maxLength={1000}
            className="input-base w-full resize-none"
          />
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="btn-primary mt-3 gap-2 disabled:opacity-50"
          >
            {submitting && <Loader2 size={15} className="animate-spin" />}
            Enviar reseña
          </button>
        </div>
      ) : null}
    </section>
  );
}