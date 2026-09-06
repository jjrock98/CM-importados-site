// ============================================================
// DATABASE TYPES
// ============================================================

export interface Profile {
  id: string; email: string; nombre: string | null; avatar_url: string | null;
  direccion: string | null; ciudad: string | null; codigo_postal: string | null;
  telefono: string | null; rol: 'cliente' | 'admin';
  created_at: string; updated_at: string;
}

export interface PriceTier {
  min_docenas:   number;
  precio_docena: number;
}

export interface Product {
  id: string; nombre: string; slug: string;
  descripcion: string | null; descripcion_corta: string | null;
  imagenes: string[]; videos: string[]; stock_unidades: number;
  precio_media_docena: number | null; precio_docena: number;
  venta_minorista:     boolean;
  venta_mayorista:     boolean;
  precio_unitario:     number | null;
  stock_minorista_min: number;
  stock_minorista_max: number;
  colores: string[]; talles: string[];
  activo: boolean; destacado: boolean;
  created_at: string; updated_at: string;
  variants?: ProductVariant[];
  /** Escalones de precio por volumen (docenas). Vacío = sin descuento por volumen. */
  precio_tiers: PriceTier[];
}

export interface ClienteMayorista {
  id: string;
  profile_id: string;
  monto_minimo_pedido: number | null;
  descuento_fijo_pct: number;
  limite_cuenta_corriente: number;
  saldo_cuenta_corriente: number;
  notas: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Variante de producto por combinación talla+color, con stock propio
 * e independiente. Solo aplica al canal minorista — los packs
 * mayoristas siempre usan products.stock_unidades.
 */
/**
 * Desglose de un pack surtido mayorista (B2B): qué combinación exacta
 * de talle/color entró en el pack de 6 o 12 unidades, armado con
 * distribución aleatoria por generar_curva_pack().
 */
export interface CurvaBreakdownItem {
  variant_id: string;
  talla:      string;
  color:      string;
  cantidad:   number;
}

export interface ProductVariant {
  id:             string;
  product_id:     string;
  talla:          string;
  color:          string;
  stock_unidades: number;
  sku:            string | null;
  imagen_url:     string | null;
  activo:         boolean;
  created_at:     string;
  updated_at:     string;
}

export type OrderEstado =
  | 'pendiente'
  | 'pendiente_pago'
  | 'pagado'
  | 'procesando'
  | 'enviado'
  | 'entregado'
  | 'cancelado'
  | 'rechazado';

export type MetodoPago  = 'mercadopago' | 'transferencia' | 'cuenta_corriente';
export type TipoPack    = 'media_docena' | 'docena' | 'unidad';
export type TipoVenta   = 'mayorista' | 'minorista';
export type TipoEntrega = 'envio' | 'retiro';

export interface Order {
  id: string;
  user_id: string | null;
  email: string;
  nombre: string;
  telefono: string | null;
  direccion: string;
  ciudad: string;
  codigo_postal: string;
  estado: OrderEstado;
  metodo_pago: MetodoPago;
  tipo_entrega: TipoEntrega;
  tipo_venta:   TipoVenta | null;
  codigo_retiro: string | null;   // ← pickup code (retiro en local)
  retiro_dni_titular: string | null;
  retiro_retira_tercero: boolean;
  retiro_tercero_nombre: string | null;
  retiro_tercero_dni: string | null;
  retirado_at: string | null;
  retirado_por: string | null;
  // MP
  mp_preference_id: string | null;
  mp_payment_id: string | null;
  mp_status_detail: string | null;
  fecha_pago: string | null;
  // Transferencia
  comprobante_url: string | null;
  comprobante_revisado: boolean;
  rejection_reason: string | null;
  reviewed_by: string | null;
  // Totales
  subtotal: number;
  costo_envio: number;
  total: number;
  notas: string | null;
  stock_descontado: boolean;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
}

export interface OrderItem {
  id: string; order_id: string; product_id: string;
  tipo_pack: TipoPack; cantidad_packs: number; unidades: number;
  precio_unit: number; subtotal: number;
  nombre_snap: string; imagen_snap: string | null;
  variant_id:   string | null;
  variant_snap: string | null;
  curva_breakdown: CurvaBreakdownItem[] | null;
  products?: Product;
}

export interface CartReservation {
  id: string; product_id: string; session_id: string;
  unidades: number; expires_at: string; created_at: string;
}

export interface WishlistItem {
  id: string; user_id: string; product_id: string;
  created_at: string; products?: Product;
}

export interface ContactMessage {
  id: string; nombre: string; email: string;
  asunto: string | null; mensaje: string;
  leido: boolean; created_at: string;
}

export interface ContactInfo {
  id: string; email: string | null; telefono: string | null;
  whatsapp: string | null; instagram: string | null;
  facebook: string | null; tiktok: string | null; horario: string | null;
  direccion: string | null; updated_at: string;
}

export interface LocationInfo {
  id: string; mapa_iframe_url: string | null; descripcion: string | null;
  video1_url: string | null; video1_titulo: string | null;
  video2_url: string | null; video2_titulo: string | null;
  updated_at: string;
}

export interface BankInfo {
  id: string; titular: string | null; cbu: string | null;
  alias: string | null; banco: string | null;
  tipo_cuenta: string | null; cuit: string | null;
  instrucciones: string | null; updated_at: string;
}

export interface SiteSetting {
  id: string; clave: string; valor: string | null;
  descripcion: string | null; updated_at: string;
}

// ============================================================
// CART TYPES
// ============================================================

export interface CartItem {
  productId: string; productSlug: string;
  nombre: string; imagen: string;
  tipoPack: TipoPack; cantidadPacks: number;
  unidades: number; precioUnitario: number; subtotal: number;
  esMinorista?: boolean;
  variantId?:    string | null;
  variantLabel?: string | null; // ej: "Talla M / Azul"
  /** Escalones de precio por volumen del producto (solo aplica a tipoPack='docena') */
  precioTiers?: PriceTier[];
  /** Precio de docena SIN descuento por volumen — base para recalcular al cambiar cantidad */
  precioBaseDocena?: number;
}

// ============================================================
// CHECKOUT TYPES
// ============================================================

export interface CheckoutFormData {
  nombre: string; email: string; telefono: string;
  direccion: string; ciudad: string; codigo_postal: string;
  notas?: string; metodo_pago: MetodoPago; tipo_entrega: TipoEntrega;
}

export interface CreateOrderPayload {
  items: { product_id: string; tipo_pack: TipoPack; cantidad_packs: number; variant_id?: string | null }[];
  formData: CheckoutFormData;
  subtotal: number; costo_envio: number; total: number;
}

// ============================================================
// API RESPONSE TYPES
// ============================================================

export interface ApiResponse<T = unknown> {
  data?: T; error?: string; message?: string;
}

export interface MPPreferenceResponse {
  preferenceId: string; initPoint: string; sandboxInitPoint: string;
}

// ============================================================
// PACK CONFIG
// ============================================================

export const PACK_CONFIG: Record<TipoPack, { label: string; labelCorto: string; unidades: number; esMinorista: boolean }> = {
  media_docena: { label: 'Media Docena (6 uds)', labelCorto: '½ Docena', unidades: 6,  esMinorista: false },
  docena:       { label: 'Docena (12 uds)',       labelCorto: 'Docena',   unidades: 12, esMinorista: false },
  unidad:       { label: 'Por unidad',            labelCorto: 'Unitario', unidades: 1,  esMinorista: true  },
};

export type MPPaymentStatus = 'approved' | 'pending' | 'rejected' | 'cancelled' | null;
export const MP_CASH_STATUS_DETAILS = ['waiting_for_payment', 'pending_waiting_payment'] as const;
export type MPStatusDetail = typeof MP_CASH_STATUS_DETAILS[number] | string;

export interface NotificacionAdmin {
  id:         string;
  tipo:       'email' | 'push' | 'in_app';
  evento:     string;
  order_id:   string | null;
  enviado:    boolean;
  error:      string | null;
  created_at: string;
}