import { createClient } from '@/lib/supabase/server';
import { PrintButton } from '@/components/orders/PrintButton';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { formatPrice, formatDate, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, getCashCouponExpiry } from '@/utils';
import { PACK_CONFIG } from '@/types';
import type { Order } from '@/types';
import { ArrowLeft, Package, Printer, ExternalLink, MapPin, Store, Navigation, Receipt, CalendarClock, MessageCircle } from 'lucide-react';
import { OrderCancelButton } from '@/components/orders/OrderCancelButton';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
interface Props { params: Promise<{ id: string }> }
export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  return { title: `Pedido #${id.slice(0,8).toUpperCase()}` };
}

// 'pendiente_pago' se trata como sub-estado de 'pendiente' en el timeline
// (cupón de efectivo generado, esperando acreditación)
const ALL_STEPS    = ['pendiente','pagado','procesando','enviado','entregado'];
const RETIRO_STEPS = ['pendiente','pagado','procesando','entregado'];

/** Mapea 'pendiente_pago' al paso visual de 'pendiente' para el timeline */
function normalizeStepEstado(estado: string): string {
  return estado === 'pendiente_pago' ? 'pendiente' : estado;
}

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login?redirect=/mis-pedidos');

  const { data: order } = await supabase
    .from('orders')
    .select('id,nombre,email,telefono,direccion,ciudad,codigo_postal,estado,metodo_pago,tipo_entrega,codigo_retiro,retiro_dni_titular,retiro_retira_tercero,retiro_tercero_nombre,retiro_tercero_dni,retirado_at,mp_payment_id,mp_status_detail,fecha_pago,comprobante_url,comprobante_revisado,rejection_reason,subtotal,costo_envio,total,notas,stock_descontado,created_at,updated_at, order_items(id,tipo_pack,cantidad_packs,unidades,precio_unit,subtotal,nombre_snap,imagen_snap,variant_id,variant_snap,curva_breakdown)')
    .eq('id', id).eq('user_id', user.id).single();

  if (!order) notFound();
  const o = order as unknown as Order;

  const isRetiro    = o.tipo_entrega === 'retiro';
  const isCancelled = o.estado === 'cancelado';
  const canCancel   = o.estado === 'pendiente' && !o.stock_descontado;
  const steps       = isRetiro ? RETIRO_STEPS : ALL_STEPS;
  const currentStep = isCancelled ? -1 : steps.indexOf(normalizeStepEstado(o.estado));

  // Get store location for retiro
  const admin = createAdminClient();
  const [{ data: contactInfo }] = await Promise.all([
    admin.from('contact_info').select('direccion,telefono,horario').single(),
  ]);
  const mapsUrl = contactInfo?.direccion
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contactInfo.direccion)}`
    : 'https://maps.google.com';

  // ✅ Envío a coordinar por WhatsApp — mismo número que se usa en el resto
  // del sitio (carrito, checkout, footer). Solo tiene sentido si el pedido
  // no es retiro en local, no está cancelado, y el envío aún no tiene un
  // costo cargado (sigue "a coordinar").
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
  const showEnvioWhatsApp = !isRetiro && !isCancelled && o.costo_envio === 0 && !!whatsappNumber;
  const envioWhatsAppUrl = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
        `Hola! Quiero coordinar el envío de mi pedido #${o.id.slice(0, 8).toUpperCase()}.`
      )}`
    : '';

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <Link href="/mis-pedidos" className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground no-print">
          <ArrowLeft size={15} /> Mis pedidos
        </Link>
        <PrintButton orderNumber={o.id.slice(0,8).toUpperCase()} />
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Pedido <span className="font-mono">#{o.id.slice(0,8).toUpperCase()}</span></h1>
          <p className="text-sm text-muted mt-1">{formatDate(o.created_at)}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {isRetiro && (
            <span className="badge bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400 gap-1.5">
              <Store size={11} /> Retiro en local
            </span>
          )}
          <span className={`badge text-sm px-3 py-1.5 ${ORDER_STATUS_COLORS[o.estado]}`}>
            {ORDER_STATUS_LABELS[o.estado]}
          </span>
        </div>
      </div>

      {/* Timeline */}
      {!isCancelled && (
        <div className="card p-5 mb-5 overflow-x-auto">
          <div className="flex items-start min-w-max">
            {steps.map((step, i) => (
              <div key={step} className="flex flex-1 items-center last:flex-none">
                <div className={`flex flex-col items-center gap-1.5 ${i <= currentStep ? 'text-brand-600' : 'text-muted'}`}>
                  <div className={`h-3 w-3 rounded-full border-2 transition-all ${
                    i < currentStep  ? 'bg-brand-500 border-brand-500' :
                    i === currentStep ? 'bg-white border-brand-500 ring-2 ring-brand-200 dark:ring-brand-800' :
                    'bg-surface-2 border-border'}`} />
                  <span className="text-[10px] font-medium text-center w-14 leading-tight">
                    {ORDER_STATUS_LABELS[step]}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 mb-4 ${i < currentStep ? 'bg-brand-500' : 'bg-border'}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {isCancelled && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 px-4 py-3 mb-5 text-sm text-red-600 dark:text-red-400">
          <p className="font-medium">Pedido cancelado.</p>
          {o.rejection_reason && <p className="mt-1">Motivo: {o.rejection_reason}</p>}
        </div>
      )}

      {/* ✅ Comprobante de transferencia en revisión */}
      {o.estado === 'pendiente_pago' && o.metodo_pago === 'transferencia' && (
        <div className="card border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/10 p-5 mb-5">
          <h2 className="font-semibold text-blue-800 dark:text-blue-400 flex items-center gap-2 mb-2">
            🔎 Comprobante en revisión
          </h2>
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Recibimos tu comprobante de transferencia. Lo estamos verificando y en breve confirmaremos tu pedido.
          </p>
        </div>
      )}

      {/* ✅ Cupón de efectivo pendiente de pago */}
      {o.estado === 'pendiente_pago' && o.metodo_pago === 'mercadopago' && (
        <div className="card border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/10 p-5 mb-5">
          <h2 className="font-semibold text-amber-800 dark:text-amber-400 flex items-center gap-2 mb-3">
            <Receipt size={18} /> Cupón de pago en efectivo generado
          </h2>
          <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
            Tu pedido está reservado. Pagá el cupón que te enviamos por email
            en Rapipago, Pago Fácil u otro punto habilitado.
          </p>
          <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-300 bg-amber-100/50 dark:bg-amber-950/30 rounded-lg p-3">
            <CalendarClock size={15} className="mt-0.5 shrink-0" />
            <span>
              Vence el <strong>{getCashCouponExpiry(o.created_at)}</strong>. Si no pagás antes,
              el pedido se cancela automáticamente y el stock se libera.
            </span>
          </div>
        </div>
      )}

      {/* ✅ RETIRO EN LOCAL */}
      {isRetiro && !isCancelled && (
        <div className="card border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/10 p-5 mb-5">
          <h2 className="font-semibold text-green-800 dark:text-green-400 flex items-center gap-2 mb-4">
            <Store size={18} /> Retiro en local
          </h2>

          {/* ── Código de retiro ───────────────────────────────────────────
              Solo se muestra cuando el pago está confirmado.
              Pendiente / pendiente_pago → el cliente aún no pagó,
              no tiene sentido darle el código todavía.
          ─────────────────────────────────────────────────────────────── */}
          {o.codigo_retiro && ['pagado', 'procesando', 'enviado', 'entregado'].includes(o.estado) && (
            <div className={`rounded-xl border-2 p-4 mb-4 text-center ${
              o.estado === 'entregado'
                ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/20'
                : 'border-green-400 dark:border-green-600 bg-white dark:bg-green-950/20'
            }`}>
              <p className={`text-xs font-semibold uppercase tracking-widest mb-2 ${
                o.estado === 'entregado' ? 'text-muted' : 'text-green-700 dark:text-green-400'
              }`}>
                {o.estado === 'entregado' ? 'Código utilizado' : '🏪 Tu código de retiro'}
              </p>

              <p className={`font-mono text-4xl font-black tracking-[0.25em] select-all ${
                o.estado === 'entregado'
                  ? 'text-muted line-through'
                  : 'text-green-700 dark:text-green-300'
              }`}>
                {o.codigo_retiro}
              </p>

              {o.estado !== 'entregado' && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                  {o.estado === 'procesando'
                    ? '⏳ Tu pedido está siendo preparado. Te avisaremos cuando esté listo para retirar.'
                    : 'Presentá este código en el local para retirar tu pedido.'}
                </p>
              )}
              {o.estado === 'entregado' && (
                <p className="text-xs text-muted mt-2">✅ Pedido retirado exitosamente.</p>
              )}
            </div>
          )}

          {o.codigo_retiro && ['pagado', 'procesando', 'enviado'].includes(o.estado) && (
            <p className="text-xs text-green-700 dark:text-green-300 mb-2">
              🪪 No te olvides de llevar tu DNI: en el local vamos a pedirte el código junto con el documento
              {o.retiro_retira_tercero
                ? ` de ${o.retiro_tercero_nombre} (la persona que autorizaste a retirar).`
                : ' para confirmar la entrega.'}
            </p>
          )}

          {/* Mientras el pago no esté confirmado, aviso en lugar del código */}
          {['pendiente', 'pendiente_pago'].includes(o.estado) && (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-4 py-3 mb-4">
              <p className="text-sm text-amber-700 dark:text-amber-400 flex items-start gap-2">
                <span className="text-base shrink-0">🔒</span>
                <span>
                  Tu código de retiro estará disponible una vez que el pago sea confirmado.
                  {o.estado === 'pendiente_pago' && o.metodo_pago === 'mercadopago'
                    ? ' Puede tardar unos minutos en acreditarse.'
                    : o.metodo_pago === 'transferencia'
                      ? ' Lo verás aquí cuando el admin apruebe tu comprobante.'
                      : ''}
                </span>
              </p>
            </div>
          )}

          {/* Datos del local */}
          <div className="space-y-2 text-sm text-green-700 dark:text-green-300">
            {contactInfo?.direccion && (
              <div className="flex items-start gap-2">
                <MapPin size={15} className="mt-0.5 shrink-0" />
                <span className="font-medium">{contactInfo.direccion}</span>
              </div>
            )}
            {contactInfo?.telefono && <p>📞 {contactInfo.telefono}</p>}
            {contactInfo?.horario
              ? <p>🕐 {contactInfo.horario}</p>
              : <p>🕐 Lunes a viernes de 9 a 18hs</p>}
          </div>

          <div className="flex gap-3 mt-4">
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="btn-primary gap-2 text-sm py-2">
              <Navigation size={15} /> Cómo llegar
            </a>
            <Link href="/ubicacion" className="btn-secondary gap-2 text-sm py-2">
              <MapPin size={15} /> Ver ubicación
            </Link>
          </div>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-5">
        {/* Products */}
        <div className="md:col-span-3">
          <div className="card p-5">
            <h2 className="font-semibold mb-4">Productos</h2>
            <div className="space-y-4">
              {(o.order_items ?? []).map((item) => (
                <div key={item.id} className="flex gap-3">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-surface-2">
                    {item.imagen_snap
                      ? <Image src={item.imagen_snap} alt={item.nombre_snap} fill className="object-cover" sizes="56px" />
                      : <Package size={20} className="m-auto text-muted absolute inset-0" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-1">{item.nombre_snap}</p>
                    <p className="text-xs text-muted">
                      {PACK_CONFIG[item.tipo_pack]?.label} × {item.cantidad_packs} · {item.unidades} uds
                      {item.variant_snap && (
                        <span className="ml-1.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 text-[10px] font-semibold">
                          {item.variant_snap}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted">{formatPrice(item.precio_unit)}/pack</p>
                    {/* ✅ Pack surtido — el cliente ve qué talles/colores recibió */}
                    {item.curva_breakdown && item.curva_breakdown.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {item.curva_breakdown.map((c, i) => (
                          <span key={i} className="text-[10px] bg-surface-2 rounded px-1.5 py-0.5 font-medium text-muted">
                            {c.cantidad}× Talla {c.talla} / {c.color}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-sm font-semibold shrink-0">{formatPrice(item.subtotal)}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-border mt-4 pt-4 space-y-2 text-sm">
              <div className="flex justify-between text-muted"><span>Subtotal</span><span>{formatPrice(o.subtotal)}</span></div>
              <div className="flex justify-between text-muted">
                <span>Envío</span>
                <span>{isRetiro ? <span className="text-green-600 font-medium">Retiro en local</span> : (o.costo_envio > 0 ? formatPrice(o.costo_envio) : <span className="text-xs">A coordinar</span>)}</span>
              </div>
              <div className="flex justify-between font-bold text-base border-t border-border pt-2">
                <span>Total</span><span className="text-brand-600">{formatPrice(o.total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Info + Actions */}
        <div className="md:col-span-2 space-y-4">
          <div className="card p-5 space-y-2.5 text-sm">
            <h2 className="font-semibold">{isRetiro ? 'Datos de contacto' : 'Entrega'}</h2>
            <p className="text-muted">{o.nombre}</p>
            <p className="text-muted">{o.email}</p>
            {o.telefono && <p className="text-muted">{o.telefono}</p>}
            {!isRetiro && <><p className="text-muted">{o.direccion}</p><p className="text-muted">{o.ciudad} ({o.codigo_postal})</p></>}
            {o.notas && <p className="text-muted italic text-xs border-t border-border pt-2">Nota: {o.notas}</p>}
            {showEnvioWhatsApp && (
              <a
                href={envioWhatsAppUrl}
                target="_blank" rel="noopener noreferrer"
                className="btn-secondary w-full text-center text-xs py-2 gap-1.5 mt-1"
              >
                <MessageCircle size={13} /> Coordinar envío por WhatsApp
              </a>
            )}
          </div>
          <div className="card p-5 space-y-2 text-sm">
            <h2 className="font-semibold">Pago</h2>
            <p className="text-muted capitalize">{o.metodo_pago}</p>
            <p className="text-muted">{o.stock_descontado ? '✅ Pago confirmado' : '⏳ Pendiente de confirmación'}</p>
            {o.comprobante_url && (
              <a href={o.comprobante_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-brand-600 hover:underline text-xs">
                <ExternalLink size={12} /> Ver comprobante
              </a>
            )}
          </div>
          <div className="space-y-2">
            {o.estado === 'pendiente' && o.metodo_pago === 'transferencia' && !o.comprobante_url && (
              <Link href={`/subir-comprobante?orderId=${o.id}`} className="btn-primary w-full text-center text-sm py-2.5">
                Subir comprobante →
              </Link>
            )}
            {canCancel && <OrderCancelButton orderId={o.id} />}
          </div>
        </div>
      </div>
    </div>
  );
}