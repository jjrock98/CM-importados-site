import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { PriceTier } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', minimumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  // ✅ FIX hidratación: sin `timeZone` explícito, Intl.DateTimeFormat usa el
  // huso horario del entorno que lo ejecuta. El servidor (Vercel) suele
  // correr en UTC y el navegador del cliente en horario de Argentina — sin
  // este fijo, el string formateado en el render del servidor no coincide
  // con el que arma React al hidratar en el cliente, y React tira un
  // hydration mismatch (además de mostrar la hora incorrecta un instante).
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date(dateStr));
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function getYouTubeEmbedUrl(url: string): string {
  if (!url) return '';
  const regexps = [
    /youtu\.be\/([a-zA-Z0-9_-]+)/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/,
    /[?&]v=([a-zA-Z0-9_-]+)/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]+)/,
  ];
  for (const re of regexps) {
    const match = url.match(re);
    if (match) return `https://www.youtube.com/embed/${match[1]}`;
  }
  return url;
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + '…';
}

// ============================================================
// ORDER STATUS — incluye 'pendiente_pago' para pagos en efectivo
// ============================================================

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pendiente:       'Pendiente',
  pendiente_pago:  'Esperando pago',   // ← cupón efectivo generado
  pagado:          'Pagado',
  procesando:      'Procesando',
  enviado:         'Enviado',
  entregado:       'Entregado',
  cancelado:       'Cancelado',
};

export const ORDER_STATUS_COLORS: Record<string, string> = {
  pendiente:       'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  pendiente_pago:  'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  pagado:          'bg-green-100  text-green-800  dark:bg-green-900/30  dark:text-green-400',
  procesando:      'bg-blue-100   text-blue-800   dark:bg-blue-900/30   dark:text-blue-400',
  enviado:         'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  entregado:       'bg-teal-100   text-teal-800   dark:bg-teal-900/30   dark:text-teal-400',
  cancelado:       'bg-red-100    text-red-800    dark:bg-red-900/30    dark:text-red-400',
};

/** Calcula la fecha de vencimiento de un cupón de efectivo (+3 días) */
export function getCashCouponExpiry(createdAt?: string): string {
  const base = createdAt ? new Date(createdAt) : new Date();
  // ✅ FIX: setDate/getDate operan sobre el día "local" del entorno que
  // ejecuta el código — en el servidor (UTC) puede dar un día distinto que
  // en el cliente (Argentina), especialmente cerca de la medianoche. Se usa
  // la variante UTC para que la suma de 3 días sea el mismo instante
  // absoluto sin importar dónde corra el código.
  const expiry = new Date(base.getTime() + 3 * 24 * 60 * 60 * 1000);
  // ✅ FIX hidratación: mismo motivo que formatDate — timeZone fijo para que
  // el string coincida entre el render del servidor y la hidratación del
  // cliente.
  return expiry.toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}

export const TIPO_VENTA_LABELS: Record<string, string> = {
  mayorista: 'Mayorista (packs)',
  minorista: 'Minorista (unidades)',
};

// ============================================================
// FEATURE 1 — Precio escalonado por volumen (quiebre de precio)
// ============================================================

/**
 * Devuelve el precio por docena que corresponde según la cantidad de
 * docenas compradas, aplicando el escalón más alto cuyo `min_docenas`
 * sea <= cantidadDocenas. Si no hay ningún escalón aplicable (compra
 * menor al primer escalón, o el producto no tiene tiers cargados),
 * devuelve `precioBase` sin descuento.
 *
 * Solo aplica a compra por docena — media docena y unidad siempre usan
 * su precio fijo, sin quiebre por volumen.
 */
export function getPrecioEscalonado(
  tiers: PriceTier[] | null | undefined,
  cantidadDocenas: number,
  precioBase: number
): number {
  if (!tiers || tiers.length === 0) return precioBase;
  const aplicables = [...tiers]
    .filter((t) => cantidadDocenas >= t.min_docenas)
    .sort((a, b) => b.min_docenas - a.min_docenas); // el escalón más exigente primero
  return aplicables.length > 0 ? aplicables[0].precio_docena : precioBase;
}

/** Próximo escalón no alcanzado todavía (para mostrar "comprando N más, pagás $X") */
export function getProximoEscalon(
  tiers: PriceTier[] | null | undefined,
  cantidadDocenas: number
): PriceTier | null {
  if (!tiers || tiers.length === 0) return null;
  const noAlcanzados = [...tiers]
    .filter((t) => cantidadDocenas < t.min_docenas)
    .sort((a, b) => a.min_docenas - b.min_docenas);
  return noAlcanzados[0] ?? null;
}