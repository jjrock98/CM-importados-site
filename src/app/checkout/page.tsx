'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCartStore } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { formatPrice } from '@/utils';
import { PACK_CONFIG } from '@/types';
import type { MetodoPago } from '@/types';
import { pixelInitiateCheckout, pixelPurchase } from '@/lib/fbpixel';
import { Wallet, Building2, AlertCircle, Loader2, ExternalLink, MapPin, Store, Truck, CheckCircle2, MessageCircle, CreditCard } from 'lucide-react';
import { cn } from '@/utils';
import toast from 'react-hot-toast';

type TipoEntrega = 'envio' | 'retiro';

const PAYMENT_METHODS: { id: MetodoPago; label: string; desc: string; icon: React.ReactNode }[] = [
  // ✅ Transferencia primero — es el método principal del negocio hoy
  // (sin comisión, sin depender de Mercado Pago). Mercado Pago sigue
  // disponible pero se lo deja después y con menos color, sin perder
  // visibilidad ni funcionalidad.
  { id: 'transferencia', label: 'Transferencia bancaria', desc: 'Subí el comprobante para confirmar',    icon: <Building2 size={20} className="text-green-600" /> },
  { id: 'mercadopago',   label: 'Mercado Pago',        desc: 'Débito, dinero en cuenta y más — sin tarjeta de crédito', icon: <Wallet size={20} className="text-muted" /> },
];


// ── WhatsApp checkout helper ──────────────────────────────────────────────────
function buildWhatsAppMessage({
  items,
  form,
  tipoEntrega,
  subtotal,
  total,
}: {
  items: import('@/types').CartItem[];
  form: { nombre: string; email: string; telefono: string; direccion: string; ciudad: string; codigo_postal: string; notas: string };
  tipoEntrega: 'envio' | 'retiro';
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
    tipoEntrega === 'envio' ? '   Envío: a coordinar' : '   Envío: Retiro en local',
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

type MPStatus = 'idle' | 'opening' | 'waiting';

export default function CheckoutPage() {
  const router   = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const { items, subtotal, total, clearCart } = useCartStore();

  const [form, setForm] = useState({
    nombre: '', email: '', telefono: '',
    direccion: '', ciudad: '', codigo_postal: '', notas: '',
    retiro_dni_titular: '', retiro_tercero_nombre: '', retiro_tercero_dni: '',
  });
  const [retiraTercero, setRetiraTercero] = useState(false);
  const [metodo,      setMetodo]      = useState<MetodoPago>('transferencia');
  const [tipoEntrega, setTipoEntrega] = useState<TipoEntrega>('envio');
  const [submitting,  setSub]         = useState(false);
  const [mpStatus,    setMpStatus]    = useState<MPStatus>('idle');
  const [mpUrl,       setMpUrl]       = useState('');
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;

  // ── Condiciones comerciales del cliente (descuento fijo, mínimo, cuenta
  //    corriente) — solo tiene datos reales si está logueado y tiene una
  //    fila activa en clientes_mayoristas; si no, quedan en 0/general. ──────
  const [condiciones, setCondiciones] = useState({
    descuento_fijo_pct: 0,
    monto_minimo_pedido: 0,
    limite_cuenta_corriente: 0,
    saldo_cuenta_corriente: 0,
    disponible_cuenta_corriente: 0,
  });
  useEffect(() => {
    fetch('/api/mi-cuenta/condiciones')
      .then((r) => r.json())
      .then(({ data }) => { if (data) setCondiciones(data); })
      .catch(() => {});
  }, [user]);

  const subtotalConDescuento = condiciones.descuento_fijo_pct > 0
    ? Math.round(subtotal * (1 - condiciones.descuento_fijo_pct / 100))
    : subtotal;
  const descuentoMonto = subtotal - subtotalConDescuento;
  const bajoMinimo = condiciones.monto_minimo_pedido > 0 && subtotalConDescuento < condiciones.monto_minimo_pedido;
  const faltaParaMinimo = condiciones.monto_minimo_pedido - subtotalConDescuento;
  const tieneCuentaCorriente = condiciones.limite_cuenta_corriente > 0;

  // ✅ Facebook Pixel — InitiateCheckout on page load
  useEffect(() => {
    if (items.length > 0) {
      pixelInitiateCheckout({
        value:      subtotal,
        numItems:   items.reduce((a, i) => a + i.cantidadPacks, 0),
        contentIds: items.map((i) => i.productId),
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [pendingId,   setPendingId]   = useState('');

  useEffect(() => {
    if (profile) {
      setForm((p) => ({
        ...p,
        nombre:        profile.nombre        ?? '',
        email:         profile.email         ?? '',
        telefono:      profile.telefono      ?? '',
        direccion:     profile.direccion     ?? '',
        ciudad:        profile.ciudad        ?? '',
        codigo_postal: profile.codigo_postal ?? '',
      }));
    }
  }, [profile]);

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));

  // El envío ya no se calcula automáticamente — se coordina después del
  // pedido (WhatsApp, chat en vivo, o personalmente). El total del pedido
  // nunca incluye el envío.
  const calcTotal = subtotalConDescuento;

  const createOrder = async () => {
    const sessionId = typeof window !== 'undefined'
      ? localStorage.getItem('cart-session-id') ?? ''
      : '';

    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': sessionId,    // ✅ M3: permite liberar reservas del carrito
      },
      body: JSON.stringify({
        items: items.map((i) => ({ product_id: i.productId, tipo_pack: i.tipoPack, cantidad_packs: i.cantidadPacks, variant_id: i.variantId ?? null })),
        formData: { ...form, metodo_pago: metodo, tipo_entrega: tipoEntrega, retiro_retira_tercero: retiraTercero },
        subtotal: subtotalConDescuento,
        costo_envio: 0,
        total: calcTotal,
      }),
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    return json.data.id as string;
  };

  const openMPPopup = (url: string) => {
    const w = 1050, h = 700;
    const left = Math.round(screen.width  / 2 - w / 2);
    const top  = Math.round(screen.height / 2 - h / 2);
    const popup = window.open(url, 'MercadoPago', `width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no`);
    if (!popup || popup.closed) { toast('Tu navegador bloqueó la ventana. Redirigiendo…', { icon: 'ℹ️' }); window.location.href = url; }
    return popup;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) { toast.error('Tu carrito está vacío'); return; }
    if (bajoMinimo) {
      toast.error(`El pedido mínimo es ${formatPrice(condiciones.monto_minimo_pedido)}. Te faltan ${formatPrice(faltaParaMinimo)}.`);
      return;
    }
    if (metodo === 'cuenta_corriente' && calcTotal > condiciones.disponible_cuenta_corriente) {
      toast.error(`Cupo de cuenta corriente insuficiente. Disponible: ${formatPrice(condiciones.disponible_cuenta_corriente)}`);
      return;
    }
    if (tipoEntrega === 'retiro') {
      if (form.retiro_dni_titular.trim().length < 6) {
        toast.error('Ingresá tu DNI/documento (lo vas a necesitar para retirar el pedido)');
        return;
      }
      if (retiraTercero && (form.retiro_tercero_nombre.trim().length < 2 || form.retiro_tercero_dni.trim().length < 6)) {
        toast.error('Completá el nombre y DNI de la persona que va a retirar');
        return;
      }
    }
    setSub(true);
    try {
      const orderId = await createOrder();
      setPendingId(orderId);
      if (metodo === 'mercadopago') {
        setMpStatus('opening');
        const mpRes = await fetch('/api/checkout/mercadopago', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId }),
        });
        const { initPoint, sandboxInitPoint, error } = await mpRes.json();
        if (error) throw new Error(error);
        const url = process.env.NODE_ENV === 'production' ? initPoint : sandboxInitPoint;
        setMpUrl(url);
        // ✅ Facebook Pixel — Purchase (MP)
        pixelPurchase({
          orderId:    orderId,
          value:      calcTotal,
          contentIds: items.map((i) => i.productId),
          numItems:   items.reduce((a, i) => a + i.cantidadPacks, 0),
        });
        clearCart();
        setMpStatus('waiting');
        openMPPopup(url);
      } else if (metodo === 'transferencia') {
        // ✅ Facebook Pixel — Purchase (transferencia)
        pixelPurchase({
          orderId:    orderId,
          value:      calcTotal,
          contentIds: items.map((i) => i.productId),
          numItems:   items.reduce((a, i) => a + i.cantidadPacks, 0),
        });
        clearCart();
        // Invitados también suben comprobante — la página ya soporta
        // identificarlos por orderId + email (mismo patrón que /seguimiento).
        router.push(`/subir-comprobante?orderId=${orderId}${!user ? `&email=${encodeURIComponent(form.email)}` : ''}`);
      } else {
        // Cuenta corriente: el pedido ya quedó 'pagado' en el servidor
        // (se descontó del cupo del cliente) — va directo a confirmación,
        // sin paso de comprobante.
        pixelPurchase({
          orderId:    orderId,
          value:      calcTotal,
          contentIds: items.map((i) => i.productId),
          numItems:   items.reduce((a, i) => a + i.cantidadPacks, 0),
        });
        clearCart();
        toast.success('Pedido confirmado — se descontó de tu cuenta corriente');
        router.push(`/pedido-confirmado?orderId=${orderId}&email=${encodeURIComponent(form.email)}`);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al procesar');
      setSub(false);
      setMpStatus('idle');
    }
  };

  // ── Waiting for MP ───────────────────────────────────────────
  if (mpStatus === 'waiting' || mpStatus === 'opening') {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 px-4 text-center">
        <div className="rounded-2xl bg-sky-50 dark:bg-sky-950/20 p-6"><Wallet size={48} className="text-sky-500 mx-auto" /></div>
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-bold">
            {mpStatus === 'opening' ? 'Abriendo Mercado Pago…' : 'Completá el pago en la ventana de Mercado Pago'}
          </h1>
          <p className="text-muted max-w-sm text-sm">Se abrió una ventana nueva. Una vez que completes el pago, serás redirigido automáticamente.</p>
        </div>
        {mpStatus === 'waiting' && (
          <div className="card p-4 w-full max-w-xs space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted">Pedido</span><span className="font-mono font-bold">#{pendingId.slice(0,8).toUpperCase()}</span></div>
            <div className="flex justify-between"><span className="text-muted">Total</span><span className="font-bold text-brand-600">{formatPrice(calcTotal)}</span></div>
          </div>
        )}
        <div className="flex flex-col gap-3 w-full max-w-xs">
          {mpUrl && <button onClick={() => openMPPopup(mpUrl)} className="btn-primary gap-2 w-full"><ExternalLink size={15} />Reabrir ventana de pago</button>}
          <Link href="/mis-pedidos" className="btn-secondary w-full text-center text-sm">Ver mis pedidos</Link>
        </div>
        <p className="text-xs text-muted max-w-xs">¿Ya pagaste? Revisá <Link href="/mis-pedidos" className="text-brand-600 hover:underline">tus pedidos</Link>.</p>
      </div>
    );
  }

  const handleWhatsApp = () => {
    if (!whatsappNumber) { toast.error('WhatsApp no está configurado'); return; }
    if (!form.nombre.trim() || !form.email.trim()) {
      toast.error('Completá tu nombre y email antes de continuar por WhatsApp');
      return;
    }
    if (tipoEntrega === 'envio' && (!form.direccion.trim() || !form.ciudad.trim())) {
      toast.error('Completá tu dirección de envío');
      return;
    }
    if (items.length === 0) { toast.error('El carrito está vacío'); return; }

    const message = buildWhatsAppMessage({
      items, form, tipoEntrega, subtotal,
      total: calcTotal,
    });
    window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  if (authLoading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-muted" size={32} /></div>;
  if (items.length === 0) return <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3"><p className="text-muted">No hay productos en el carrito.</p><Link href="/" className="btn-primary">Ver productos</Link></div>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="font-display text-3xl font-bold mb-8">Finalizar compra</h1>

      {/* Banner invitado */}
      {!user && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20 p-4">
          <AlertCircle size={17} className="text-blue-600 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-800 dark:text-blue-300">
            <p className="font-semibold mb-0.5">Estás comprando como invitado</p>
            <p>Completá tus datos abajo. Si querés guardar tu historial,{' '}
              <Link href="/auth/login?redirect=/checkout" className="underline font-medium">iniciá sesión</Link>
              {' '}o{' '}
              <Link href="/auth/registro?redirect=/checkout" className="underline font-medium">creá una cuenta</Link>.
            </p>
          </div>
        </div>
      )}

      {/* Banner perfil incompleto (solo usuarios logueados) */}
      {user && (!profile?.direccion || !profile?.codigo_postal || !profile?.telefono) && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
          <AlertCircle size={17} className="text-yellow-600 mt-0.5 shrink-0" />
          <p className="text-sm text-yellow-800 dark:text-yellow-300">
            Completá tus datos para agilizar el checkout.{' '}
            <Link href="/completar-perfil?redirect=/checkout" className="underline font-medium">Completar ahora →</Link>
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">

            {/* ── Tipo de entrega ── */}
            <div className="card p-6">
              <h2 className="font-semibold mb-4">Tipo de entrega</h2>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { id: 'envio',  label: 'Envío a domicilio', desc: 'Lo recibís en tu dirección',  icon: <Truck  size={20} className="text-brand-500" /> },
                  { id: 'retiro', label: 'Retirar en local',  desc: 'Sin costo de envío',           icon: <Store  size={20} className="text-green-600" /> },
                ] as { id: TipoEntrega; label: string; desc: string; icon: React.ReactNode }[]).map((opt) => (
                  <label key={opt.id}
                    className={cn(
                      'flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all',
                      tipoEntrega === opt.id ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/20' : 'border-border hover:border-brand-300'
                    )}>
                    <input type="radio" name="tipoEntrega" value={opt.id}
                      checked={tipoEntrega === opt.id} onChange={() => setTipoEntrega(opt.id)} className="sr-only" />
                    {opt.icon}
                    <div>
                      <p className="font-medium text-sm">{opt.label}</p>
                      <p className="text-xs text-muted">{opt.desc}</p>
                    </div>
                    {tipoEntrega === opt.id && <CheckCircle2 size={16} className="text-brand-500" />}
                  </label>
                ))}
              </div>

              {/* Retiro info */}
              {tipoEntrega === 'retiro' && (
                <div className="mt-4 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-4 space-y-2">
                  <p className="text-sm font-semibold text-green-800 dark:text-green-400 flex items-center gap-2">
                    <Store size={15} /> Datos del local
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Te avisaremos cuando tu pedido esté listo para retirar. El retiro es de lunes a viernes de 9 a 18hs.
                  </p>
                  <Link href="/ubicacion" target="_blank"
                    className="inline-flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400 underline hover:no-underline">
                    <MapPin size={12} /> Ver dirección del local →
                  </Link>
                </div>
              )}

              {/* ── Identidad de quien retira ── */}
              {tipoEntrega === 'retiro' && (
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="block text-xs font-medium mb-1">Tu DNI/documento *</label>
                    <input required value={form.retiro_dni_titular}
                      onChange={set('retiro_dni_titular')}
                      className="input-base" placeholder="Ej: 30123456"
                      inputMode="numeric" />
                    <p className="text-xs text-muted mt-1">
                      Vas a necesitar presentar este documento junto con tu código de retiro en el local.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-2">¿Quién va a retirar el pedido?</label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className={cn(
                        'flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 p-3 text-sm transition-all',
                        !retiraTercero ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/20' : 'border-border hover:border-brand-300'
                      )}>
                        <input type="radio" name="quienRetira" className="sr-only"
                          checked={!retiraTercero} onChange={() => setRetiraTercero(false)} />
                        Yo mismo/a
                      </label>
                      <label className={cn(
                        'flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 p-3 text-sm transition-all',
                        retiraTercero ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/20' : 'border-border hover:border-brand-300'
                      )}>
                        <input type="radio" name="quienRetira" className="sr-only"
                          checked={retiraTercero} onChange={() => setRetiraTercero(true)} />
                        Otra persona
                      </label>
                    </div>
                  </div>

                  {retiraTercero && (
                    <div className="grid gap-4 sm:grid-cols-2 rounded-xl border border-border p-3">
                      <div>
                        <label className="block text-xs font-medium mb-1">Nombre completo de quien retira *</label>
                        <input required value={form.retiro_tercero_nombre}
                          onChange={set('retiro_tercero_nombre')} className="input-base" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">DNI de quien retira *</label>
                        <input required value={form.retiro_tercero_dni}
                          onChange={set('retiro_tercero_dni')} className="input-base"
                          inputMode="numeric" />
                      </div>
                      <p className="sm:col-span-2 text-xs text-muted">
                        Esta persona deberá presentar el código de retiro y su DNI en el local.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Datos personales ── */}
            <div className="card p-6">
              <h2 className="font-semibold mb-4">Datos personales</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div><label className="block text-xs font-medium mb-1">Nombre *</label><input required value={form.nombre} onChange={set('nombre')} className="input-base" /></div>
                <div><label className="block text-xs font-medium mb-1">Email *</label><input required type="email" value={form.email} onChange={set('email')} className="input-base" /></div>
                <div><label className="block text-xs font-medium mb-1">Teléfono *</label><input required type="tel" value={form.telefono} onChange={set('telefono')} className="input-base" /></div>
              </div>
            </div>

            {/* ── Dirección (solo si envío) ── */}
            {tipoEntrega === 'envio' && (
              <div className="card p-6">
                <h2 className="font-semibold mb-4 flex items-center gap-2"><MapPin size={17} className="text-brand-500" />Dirección de entrega</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2"><label className="block text-xs font-medium mb-1">Dirección *</label><input required value={form.direccion} onChange={set('direccion')} className="input-base" /></div>
                  <div><label className="block text-xs font-medium mb-1">Ciudad *</label><input required value={form.ciudad} onChange={set('ciudad')} className="input-base" /></div>
                  <div><label className="block text-xs font-medium mb-1">Código postal *</label><input required value={form.codigo_postal} onChange={set('codigo_postal')} className="input-base" /></div>
                  <div className="sm:col-span-2"><label className="block text-xs font-medium mb-1">Notas (opcional)</label><textarea value={form.notas} onChange={set('notas')} rows={2} className="input-base resize-none" placeholder="Piso, depto, referencias…" /></div>
                </div>
              </div>
            )}

            {/* ── Notas para retiro ── */}
            {tipoEntrega === 'retiro' && (
              <div className="card p-6">
                <h2 className="font-semibold mb-4">Notas para el retiro (opcional)</h2>
                <textarea value={form.notas} onChange={set('notas')} rows={2} className="input-base resize-none" placeholder="Aclaraciones, horario preferido…" />
              </div>
            )}

            {/* ── Método de pago ── */}
            <div className="card p-6">
              <h2 className="font-semibold mb-1">Método de pago</h2>
              {tipoEntrega === 'retiro' && (
                <p className="text-xs text-muted mb-4">También podés pagar en efectivo directamente al retirar tu pedido en el local.</p>
              )}
              <div className={cn('space-y-3', tipoEntrega !== 'retiro' && 'mt-4')}>
                {[
                  ...PAYMENT_METHODS,
                  ...(tieneCuentaCorriente ? [{
                    id: 'cuenta_corriente' as MetodoPago,
                    label: 'Cuenta corriente',
                    desc: `Disponible: ${formatPrice(condiciones.disponible_cuenta_corriente)}`,
                    icon: <CreditCard size={20} className="text-purple-600" />,
                  }] : []),
                ].map((m) => (
                  <label key={m.id}
                    className={cn(
                      'flex cursor-pointer items-center gap-4 rounded-xl border-2 p-4 transition-all',
                      metodo === m.id ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/20' : 'border-border hover:border-brand-300'
                    )}>
                    <input type="radio" name="metodo" value={m.id} checked={metodo === m.id} onChange={() => setMetodo(m.id)} className="accent-brand-500" />
                    {m.icon}
                    <div className="flex-1">
                      <p className="font-medium text-sm">{m.label}</p>
                      <p className="text-xs text-muted">{m.desc}</p>
                    </div>
                    {m.id === 'transferencia' && <span className="text-xs bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400 rounded-full px-2 py-0.5 font-medium">Preferido</span>}
                  </label>
                ))}
              </div>
              {metodo === 'mercadopago' && (
                <div className="mt-4 rounded-xl bg-sky-50 dark:bg-sky-950/20 p-4 text-sm text-sky-800 dark:text-sky-300 flex gap-3">
                  <ExternalLink size={15} className="shrink-0 mt-0.5" />
                  <p>Se abrirá una <strong>ventana nueva</strong> con Mercado Pago para completar tu pago de forma segura.</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Resumen ── */}
          <div>
            <div className="card p-5 sticky top-24 space-y-4">
              <h2 className="font-semibold">Tu pedido</h2>
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {items.map((item) => (
                  <div key={`${item.productId}-${item.tipoPack}`} className="flex justify-between text-sm gap-2">
                    <span className="text-muted line-clamp-1 flex-1">{item.nombre} · {PACK_CONFIG[item.tipoPack].label} ×{item.cantidadPacks}</span>
                    <span className="shrink-0 font-medium">{formatPrice(item.subtotal)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-border pt-3 space-y-2 text-sm">
                <div className="flex justify-between text-muted"><span>Subtotal</span><span>{formatPrice(subtotal)}</span></div>
                {descuentoMonto > 0 && (
                  <div className="flex justify-between text-green-600 font-medium">
                    <span>Descuento cliente ({condiciones.descuento_fijo_pct}%)</span>
                    <span>−{formatPrice(descuentoMonto)}</span>
                  </div>
                )}
                <div className="flex justify-between text-muted">
                  <span>Envío</span>
                  <span>{tipoEntrega === 'retiro' ? <span className="text-green-600 font-medium">Retiro en local</span> : <span className="text-xs">A coordinar</span>}</span>
                </div>
                <div className="flex justify-between font-bold text-base border-t border-border pt-2">
                  <span>Total</span>
                  <span className="text-brand-600">{formatPrice(calcTotal)}</span>
                </div>
              </div>
              {tipoEntrega === 'envio' && (
                <p className="text-[11px] text-muted -mt-1">
                  El total no incluye el envío — te contactamos para coordinarlo (WhatsApp, chat en vivo o como prefieras).
                </p>
              )}

              {/* Aviso de pedido mínimo */}
              {bajoMinimo && (
                <div className="flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/20 p-3 text-xs text-amber-700 dark:text-amber-400">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <p>El pedido mínimo es de <strong>{formatPrice(condiciones.monto_minimo_pedido)}</strong>. Te faltan <strong>{formatPrice(faltaParaMinimo)}</strong> para poder finalizar la compra.</p>
                </div>
              )}

              <button type="submit" disabled={submitting || bajoMinimo} className="btn-primary w-full gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                {submitting
                  ? <><Loader2 size={15} className="animate-spin" />Procesando…</>
                  : metodo === 'mercadopago'
                    ? <><Wallet size={15} />Pagar con Mercado Pago</>
                    : metodo === 'cuenta_corriente'
                      ? <><CreditCard size={15} />Confirmar con cuenta corriente</>
                      : <><Building2 size={15} />Confirmar pedido</>}
              </button>
              {/* Separador */}
              <div className="flex items-center gap-2 text-xs text-muted">
                <div className="flex-1 h-px bg-border" />
                <span>o</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* ✅ Botón WhatsApp — checkout directo por chat */}
              {whatsappNumber && (
                <button
                  type="button"
                  onClick={handleWhatsApp}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-green-500 bg-green-50 dark:bg-green-950/20 py-3 px-4 text-sm font-semibold text-green-700 dark:text-green-400 hover:bg-green-500 hover:text-white dark:hover:bg-green-500 dark:hover:text-white transition-all duration-200 group"
                >
                  <MessageCircle size={18} className="transition-transform group-hover:scale-110" />
                  Comprar por WhatsApp
                </button>
              )}

              {whatsappNumber && (
                <p className="text-[10px] text-muted text-center -mt-2">
                  Te redirige a WhatsApp con el detalle completo de tu pedido
                </p>
              )}

              <p className="text-xs text-muted text-center">
                Al confirmar aceptás nuestros <Link href="/terminos" className="underline hover:text-foreground">términos y condiciones</Link>.
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
