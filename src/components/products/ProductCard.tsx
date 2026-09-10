'use client';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { Heart, Package, Bell, CheckCircle } from 'lucide-react';
import { cn, formatPrice } from '@/utils';
import { useWishlist } from '@/hooks/useWishlist';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import type { Product } from '@/types';
import { ProductModal } from './ProductModal';
import toast from 'react-hot-toast';

interface Props { product: Product }

export function ProductCard({ product: p }: Props) {
  const { isInWishlist, toggle } = useWishlist();
  const { user } = useAuth();
  const [modalOpen,   setModalOpen]   = useState(false);
  const [liveStock,   setLiveStock]   = useState(p.stock_unidades);
  const [notifEmail,  setNotifEmail]  = useState('');
  const [notifSent,   setNotifSent]   = useState(false);
  const [notifLoading,setNotifLoading]= useState(false);
  // Honeypot anti-bot: campo invisible para humanos (oculto por CSS, nunca
  // por atributo type="hidden", que los bots más básicos ya saben ignorar).
  // Si viene completado, el request es casi seguro un bot rellenando todos
  // los inputs del formulario. Se eligió honeypot en vez de un captcha
  // visible acá porque este formulario se repite una vez por cada tarjeta
  // "agotado" del catálogo — un widget de Turnstile por tarjeta sería
  // pesado y arruinaría la experiencia de navegación.
  const [website, setWebsite] = useState('');

  // ── MÓDULO 2: Stock en tiempo real via Supabase Realtime ─────────────────
  useEffect(() => {
    const supabase = createClient();
    const channel  = supabase
      .channel(`product-stock-${p.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'products', filter: `id=eq.${p.id}` },
        (payload) => {
          const updated = payload.new as Partial<Product>;
          if (typeof updated.stock_unidades === 'number') {
            setLiveStock(updated.stock_unidades);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [p.id]);

  // Media docena opcional: si el producto no tiene precio de ½ docena
  // cargado, solo se vende por docena completa (o por curva).
  const tieneMediaDocena  = p.precio_media_docena != null && p.precio_media_docena > 0;

  // ── MÓDULO 2: Tres estados visuales ──────────────────────────────────────
  const canBuyDocena      = liveStock >= 12;                          // Estado A: ambos habilitados
  const canBuyMediaDocena = tieneMediaDocena && liveStock >= 6;        // Estado B: solo media docena
  const sinStock           = tieneMediaDocena ? liveStock < 6 : liveStock < 12; // Estado C: agotado

  const inWishlist = isInWishlist(p.id);

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!user) { toast.error('Ingresá para guardar en wishlist'); return; }
    toggle(p.id);
  };

  const handleAddCart = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!sinStock) setModalOpen(true);
  };

  // ── "Avísame cuando haya stock" ──────────────────────────────────────────
  const handleNotifSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifEmail) return;
    setNotifLoading(true);
    try {
      const res = await fetch('/api/stock-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: p.id, email: notifEmail, website }),
      });
      if (res.ok) {
        setNotifSent(true);
        toast.success('¡Te avisamos cuando haya stock!');
      } else {
        toast.error('Error al registrarte. Intentá de nuevo.');
      }
    } finally {
      setNotifLoading(false);
    }
  }, [notifEmail, p.id]);

  return (
    <>
      <motion.article
        className="card-hover group relative flex h-full flex-col overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        whileHover={{ y: -2 }}
      >
        {/* Wishlist */}
        <button
          onClick={handleWishlist}
          aria-label={inWishlist ? 'Quitar de wishlist' : 'Agregar a wishlist'}
          className={cn(
            'absolute right-3 top-3 z-10 rounded-full p-1.5 backdrop-blur-sm transition-all',
            inWishlist
              ? 'bg-red-500 text-white'
              : 'bg-white/80 text-gray-500 opacity-0 group-hover:opacity-100 dark:bg-black/60'
          )}
        >
          <Heart size={16} fill={inWishlist ? 'currentColor' : 'none'} />
        </button>

        {/* Imagen */}
        <Link
          href={`/productos/${p.slug}`}
          className="relative block overflow-hidden bg-surface-2"
          style={{ aspectRatio: '1/1' }}
          aria-label={`Ver detalle de ${p.nombre}`}
        >
          {p.imagenes[0] ? (
            <Image
              src={p.imagenes[0]} alt={p.nombre} fill
              loading="lazy"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted">
              <Package size={40} />
            </div>
          )}

          {/* Badge de estado sobre la imagen */}
          {sinStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-gray-800">
                Agotado
              </span>
            </div>
          )}
          {!sinStock && !canBuyDocena && (
            <div className="absolute bottom-2 left-2">
              <span className="rounded-full bg-orange-500/90 px-2 py-0.5 text-[10px] font-bold text-white">
                Stock limitado
              </span>
            </div>
          )}
          {p.destacado && (
            <span className="absolute left-2 top-2 rounded-full bg-brand-500 px-2 py-0.5 text-[10px] font-bold text-white">
              Destacado
            </span>
          )}
        </Link>

        {/* Info */}
        <div className="flex flex-1 flex-col p-4">
          <Link href={`/productos/${p.slug}`}>
            <h3 className="line-clamp-2 text-sm font-semibold leading-tight hover:text-brand-600 transition-colors">
              {p.nombre}
            </h3>
          </Link>
          {p.descripcion_corta && (
            <p className="mt-1 line-clamp-1 text-xs text-muted">{p.descripcion_corta}</p>
          )}

          {/* Talles/colores disponibles — surtido dentro del pack */}
          {(p.talles?.length > 0 || p.colores?.length > 0) && (
            <div className="mt-2 flex flex-wrap items-center gap-1">
              {p.talles?.slice(0, 5).map((t) => (
                <span key={t} className="rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted">
                  {t}
                </span>
              ))}
              {p.colores?.length > 0 && (
                <span className="ml-1 text-[10px] text-muted">
                  {p.colores.length} color{p.colores.length !== 1 ? 'es' : ''}
                </span>
              )}
            </div>
          )}

          {/* Precios */}
          <div className="mt-3 space-y-1">
            {p.precio_media_docena != null && p.precio_media_docena > 0 && (
              <div className="flex items-center justify-between">
                <span className={cn('text-xs', !canBuyMediaDocena ? 'text-red-400 line-through' : 'text-muted')}>
                  ½ docena (6)
                </span>
                <span className={cn('text-sm font-bold', canBuyMediaDocena ? 'text-brand-600' : 'text-muted')}>
                  {formatPrice(p.precio_media_docena)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className={cn('text-xs', !canBuyDocena ? 'text-red-400 line-through' : 'text-muted')}>
                Docena (12)
              </span>
              <span className={cn('text-sm font-bold', canBuyDocena ? 'text-brand-600' : 'text-muted')}>
                {formatPrice(p.precio_docena)}
              </span>
            </div>
          </div>

          {/* Stock indicator */}
          <div className={cn(
            'mt-2 flex items-center gap-1.5 text-xs',
            sinStock ? 'text-red-500' : !canBuyDocena ? 'text-orange-500' : 'text-muted'
          )}>
            <Package size={11} />
            <span>
              {sinStock
                ? 'Sin stock disponible'
                : !canBuyDocena
                  ? `Solo ${liveStock} uds — sin stock para docena`
                  : `${liveStock} uds disponibles`
              }
            </span>
          </div>

          {/* ── Estado A y B: botón normal ─────────────────────────────────── */}
          {/* mt-auto: ancla el botón al fondo de la tarjeta sin importar cuánto
              contenido haya arriba (talles/colores que hacen wrap en mobile
              según el largo de texto), así todas las tarjetas de una fila
              quedan con el botón perfectamente alineado. */}
          {!sinStock && (
            <button
              onClick={handleAddCart}
              className="btn-primary mt-auto w-full py-2 text-xs"
              aria-label={`Agregar ${p.nombre} al carrito`}
            >
              {canBuyDocena ? 'Elegir pack' : tieneMediaDocena ? 'Comprar ½ Docena' : 'Sin stock para Docena'}
            </button>
          )}

          {/* ── Estado C: Agotado + formulario "Avísame" ──────────────────── */}
          {sinStock && (
            <div className="mt-auto space-y-2">
              <p className="text-center text-xs font-semibold text-red-500">Agotado</p>

              {!notifSent ? (
                <form onSubmit={handleNotifSubmit} className="space-y-2">
                  {/* Honeypot — oculto para personas, visible para bots que
                     completan todos los campos del formulario */}
                  <input
                    type="text"
                    name="website"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                    className="absolute left-[-9999px] h-0 w-0 opacity-0"
                  />
                  <input
                    type="email"
                    value={notifEmail}
                    onChange={(e) => setNotifEmail(e.target.value)}
                    placeholder="tu@email.com"
                    required
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <button
                    type="submit"
                    disabled={notifLoading}
                    className="btn-secondary w-full py-2 text-xs gap-1.5 flex items-center justify-center"
                  >
                    <Bell size={12} />
                    {notifLoading ? 'Registrando...' : 'Avisame cuando haya stock'}
                  </button>
                </form>
              ) : (
                <div className="flex items-center justify-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                  <CheckCircle size={14} />
                  <span>¡Te avisamos cuando haya stock!</span>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.article>

      {modalOpen && (
        <ProductModal product={{ ...p, stock_unidades: liveStock }} onClose={() => setModalOpen(false)} />
      )}
    </>
  );
}