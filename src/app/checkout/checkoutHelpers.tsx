// Constantes, tipos y el armado del mensaje de WhatsApp del checkout.
// Se movieron tal cual desde page.tsx (sin cambios de lógica) para que la
// página quede solo con el componente. El mensaje de WhatsApp tiene tests
// en src/__tests__/whatsappCheckout.test.ts.
import { PACK_CONFIG, MICRO_TERMINAL_LABELS } from '@/types';
import type { MetodoPago, MicroTerminal } from '@/types';
import { formatPrice } from '@/utils';
import { Building2, Banknote } from 'lucide-react';

export type TipoEntrega = 'envio' | 'retiro' | 'micro';

export const PAYMENT_METHODS: { id: MetodoPago; label: string; desc: string; icon: React.ReactNode }[] = [
  // ✅ Transferencia primero — es el método principal del negocio hoy
  // (sin comisión, sin depender de Mercado Pago).
  { id: 'transferencia', label: 'Transferencia bancaria', desc: 'Subí el comprobante para confirmar',    icon: <Building2 size={20} className="text-green-600" /> },
  // 🔕 Mercado Pago: deshabilitado a pedido — todavía no está listo para
  // ofrecerse a clientes. Se deja comentado (no borrado) para reactivarlo
  // más adelante en una sola línea, sin tener que rehacer nada del resto
  // del checkout (webhooks, reembolsos, emails, etc. ya soportan MP).
  // { id: 'mercadopago', label: 'Mercado Pago', desc: 'Débito, dinero en cuenta y más — sin tarjeta de crédito', icon: <Wallet size={20} className="text-muted" /> },
];

// ✅ Efectivo — solo se ofrece para 'retiro' en local o 'micro' (nunca
// para envío a domicilio, no hay nadie ahí para cobrar). El stock recién
// se reserva cuando el admin confirma que cobró (ver mark-paid).
export const EFECTIVO_METHOD: { id: MetodoPago; label: string; desc: string; icon: React.ReactNode } =
  { id: 'efectivo', label: 'Pago en efectivo', desc: 'Pagás al recibir/retirar el pedido', icon: <Banknote size={20} className="text-amber-600" /> };

export const MICRO_TERMINALS: { id: MicroTerminal; label: string }[] = (
  Object.keys(MICRO_TERMINAL_LABELS) as MicroTerminal[]
).map((id) => ({ id, label: MICRO_TERMINAL_LABELS[id] }));


// ── WhatsApp checkout helper ──────────────────────────────────────────────────
export function buildWhatsAppMessage({
  items,
  form,
  tipoEntrega,
  microTerminal,
  subtotal,
  total,
}: {
  items: import('@/types').CartItem[];
  form: { nombre: string; email: string; telefono: string; direccion: string; ciudad: string; codigo_postal: string; notas: string; micro_empresa_transporte: string; micro_nombre_recibe: string };
  tipoEntrega: TipoEntrega;
  microTerminal: MicroTerminal | null;
  subtotal: number;
  total: number;
}): string {
  const tienda  = process.env.NEXT_PUBLIC_TIENDA_NOMBRE ?? 'Mi Tienda';
  const now     = new Date();
  const fecha   = now.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' });
  const hora    = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' });

  const fmt = (n: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n);

  const packLabels: Record<string, string> = {
    media_docena: 'Media Docena (6 uds)',
    docena:       'Docena (12 uds)',
    unidad:       'Unidad',
  };

  const lineas = items.map(
    (i) => `  • ${i.nombre}${i.variantLabel ? ` (${i.variantLabel})` : ''} — ${packLabels[i.tipoPack] ?? i.tipoPack} × ${i.cantidadPacks} = ${fmt(i.subtotal)}`
  ).join('\n');

  const entregaInfo = tipoEntrega === 'retiro'
    ? '🏪 *Retiro en local*'
    : tipoEntrega === 'micro'
      ? `🚌 *Entrega en micro — La Salada*
   Terminal: ${microTerminal ? MICRO_TERMINAL_LABELS[microTerminal] : '—'}
   Micro/empresa: ${form.micro_empresa_transporte || '—'}
   Recibe: ${form.micro_nombre_recibe || '—'}`
      : `🚚 *Envío a domicilio*
   ${form.direccion}, ${form.ciudad} (CP ${form.codigo_postal})`;

  const notasLine = form.notas ? `\n📝 *Notas:* ${form.notas}` : '';

  const lines = [
    `¡Hola ${tienda}! 👋`,
    '',
    `Quiero hacer un pedido:`,
    '',
    `📋 *DETALLE DEL PEDIDO*`,
    `📅 Fecha: ${fecha} — ${hora}`,
    '',
    `👤 *Datos del cliente*`,
    `   Nombre: ${form.nombre}`,
    `   Email: ${form.email}`,
    `   Teléfono: ${form.telefono || '—'}`,
    '',
    `🛍️ *Productos*`,
    lineas,
    '',
    `💰 *Totales*`,
    `   Subtotal: ${fmt(subtotal)}`,
    tipoEntrega === 'envio' ? '   Envío: a coordinar' : tipoEntrega === 'micro' ? '   Envío: Entrega en micro (gratis)' : '   Envío: Retiro en local',
    `   *TOTAL: ${fmt(total)}*`,
    '',
    `📦 *Entrega*`,
    entregaInfo,
    notasLine,
    '',
    '¿Podés confirmarme disponibilidad? 🙏',
  ];

  // Remove consecutive empty lines
  const cleaned: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === '' && cleaned[cleaned.length - 1] === '') continue;
    cleaned.push(lines[i]);
  }

  return cleaned.join('\n');
}

export type MPStatus = 'idle' | 'opening' | 'waiting';