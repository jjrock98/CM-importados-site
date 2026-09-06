import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendOrderConfirmationEmail } from '@/lib/email';
import { sendAdminPushNotification } from '@/lib/webpush';
import { createOrderSchema, parseBody } from '@/lib/validations';
import { rateLimiters } from '@/lib/rateLimit';
import { getPrecioEscalonado } from '@/utils';
import type { TipoPack, PriceTier } from '@/types';

// ── Código de retiro: alfanumérico 8 chars, sin O/0/I/1 (ambiguos) ──────────
const RETIRO_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generarCodigoRetiro(): string {
  const bytes = randomBytes(8);
  return Array.from(bytes)
    .map((b) => RETIRO_CHARS[b % RETIRO_CHARS.length])
    .join('');
}

// ── Tipos internos para los helpers ────────────────────────────────────────
interface DBProduct {
  id: string;
  nombre: string;
  imagenes: string[];
  precio_media_docena: number | null;
  precio_docena: number;
  precio_unitario: number | null;
  venta_minorista: boolean;
  stock_minorista_min: number;
  stock_minorista_max: number;
  stock_unidades: number;
  activo: boolean;
  precio_tiers: PriceTier[];
}

interface DBVariant {
  id: string;
  talla: string;
  color: string;
  stock_unidades: number;
  activo: boolean;
}

interface ItemWithProduct {
  item: {
    product_id: string;
    tipo_pack: TipoPack;
    cantidad_packs: number;
    variant_id?: string | null;
  };
  product:    DBProduct;
  variant:    DBVariant | null;
  unidades:   number;
  precioUnit: number;
  orderItem: {
    product_id:     string;
    tipo_pack:      TipoPack;
    cantidad_packs: number;
    unidades:       number;
    precio_unit:    number;
    subtotal:       number;
    nombre_snap:    string;
    imagen_snap:    string | null;
    variant_id:     string | null;
    variant_snap:   string | null;
    curva_breakdown: { variant_id: string; talla: string; color: string; cantidad: number }[] | null;
  };
}

export async function POST(req: NextRequest) {
  const limited = rateLimiters.orders(req);
  if (limited) return limited;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    // ✅ Compra como invitado — user puede ser null (no requiere login)

    const rawBody = await req.json();
    const { data: body, error: validationError } = parseBody(createOrderSchema, rawBody);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 422 });
    if (!body) return NextResponse.json({ error: 'Datos inválidos' }, { status: 422 });

    const { items, formData, subtotal, costo_envio, total } = body;
    const admin = createAdminClient();

    // Validar stock y calcular precios en el servidor
    const itemsWithProducts: ItemWithProduct[] = await Promise.all(
      items.map(async (item) => {
        const { data: product } = await admin
          .from('products')
          .select('id, nombre, imagenes, precio_media_docena, precio_docena, precio_unitario, venta_minorista, stock_minorista_min, stock_minorista_max, stock_unidades, activo, precio_tiers')
          .eq('id', item.product_id)
          .single();

        if (!product)        throw new Error(`Producto no encontrado: ${item.product_id}`);
        if (!product.activo) throw new Error(`"${product.nombre}" ya no está disponible`);

        // ── Variante única (talla/color) si el cliente eligió minorista ──────
        let variant: DBVariant | null = null;
        if (item.variant_id) {
          const { data: v } = await admin
            .from('product_variants')
            .select('id, talla, color, stock_unidades, activo')
            .eq('id', item.variant_id)
            .eq('product_id', item.product_id)
            .single();
          if (!v || !v.activo) throw new Error(`La variante seleccionada de "${product.nombre}" ya no está disponible`);
          variant = v;
        }

        const unitsPerPack = item.tipo_pack === 'media_docena' ? 6 : item.tipo_pack === 'docena' ? 12 : 1;
        const unidades = item.cantidad_packs * unitsPerPack;

        // ══════════════════════════════════════════════════════════════════
        // PACKS SURTIDOS B2B — si es un pack mayorista (media docena/docena)
        // Y el producto tiene variantes cargadas, se arma automáticamente
        // una distribución aleatoria de talles/colores (curva), tomando del
        // MISMO pool de stock que usa minorista — no son stocks separados.
        // Si el producto no tiene variantes, sigue el comportamiento clásico
        // (descuenta del stock general del producto).
        // ══════════════════════════════════════════════════════════════════
        let curvaBreakdown: { variant_id: string; talla: string; color: string; cantidad: number }[] | null = null;

        if (!variant && (item.tipo_pack === 'media_docena' || item.tipo_pack === 'docena')) {
          const { count: variantCount } = await admin
            .from('product_variants')
            .select('*', { count: 'exact', head: true })
            .eq('product_id', item.product_id)
            .eq('activo', true);

          if (variantCount && variantCount > 0) {
            // Se arma una curva por cada pack comprado (ej: 3 packs de
            // docena = 3 curvas independientes de 12 unidades cada una,
            // sumadas al breakdown final del ítem).
            const totalUnidadesCurva = unidades;
            const { data: curvaResult } = await admin.rpc('generar_curva_pack', {
              p_product_id: item.product_id,
              p_unidades:   totalUnidadesCurva,
            });

            if (!curvaResult?.success) {
              throw new Error('Lo sentimos, el producto ya no se encuentra disponible');
            }
            curvaBreakdown = curvaResult.breakdown;
          }
        }

        // Stock efectivo para la validación de disponibilidad:
        // curva (suma del pool de variantes), variante única, o producto plano
        const stockDisponible = curvaBreakdown
          ? curvaBreakdown.reduce((a, c) => a + c.cantidad, 0)
          : variant ? variant.stock_unidades : product.stock_unidades;

        if (!curvaBreakdown && stockDisponible < unidades) {
          // ══════════════════════════════════════════════════════════════
          // REGLA DE NEGOCIO 2A — Bloqueo inmediato en checkout.
          // ══════════════════════════════════════════════════════════════
          throw new Error('Lo sentimos, el producto ya no se encuentra disponible');
        }

        let precioUnit: number;
        if (item.tipo_pack === 'unidad') {
          if (!product.venta_minorista || !product.precio_unitario) {
            throw new Error(`"${product.nombre}" no está habilitado para venta minorista`);
          }
          const minQ = product.stock_minorista_min || 1;
          const maxQ = product.stock_minorista_max || 100;
          if (item.cantidad_packs < minQ) throw new Error(`Mínimo ${minQ} unidades para "${product.nombre}"`);
          if (item.cantidad_packs > maxQ) throw new Error(`Máximo ${maxQ} unidades para "${product.nombre}"`);
          precioUnit = product.precio_unitario;
        } else if (item.tipo_pack === 'media_docena') {
          // Media docena es opcional por producto: si no tiene precio cargado,
          // no se puede vender en ese formato (evita cobrar null/0 por error).
          if (product.precio_media_docena == null) {
            throw new Error(`"${product.nombre}" no se vende por ½ docena — solo por docena completa`);
          }
          precioUnit = product.precio_media_docena;
        } else {
          // Docena — aplica precio escalonado por volumen si el producto
          // tiene tiers cargados (ej: 5+ docenas a precio más bajo).
          precioUnit = getPrecioEscalonado(product.precio_tiers, item.cantidad_packs, product.precio_docena);
        }

        return {
          item,
          product,
          variant,
          unidades,
          precioUnit,
          orderItem: {
            product_id:     item.product_id,
            tipo_pack:      item.tipo_pack,
            cantidad_packs: item.cantidad_packs,
            unidades,
            precio_unit:    precioUnit,
            subtotal:       item.cantidad_packs * precioUnit,
            nombre_snap:    product.nombre,
            imagen_snap:    product.imagenes?.[0] ?? null,
            variant_id:     variant?.id ?? null,
            variant_snap:   variant ? `Talla ${variant.talla} / ${variant.color}` : null,
            curva_breakdown: curvaBreakdown,
          },
        };
      })
    );

    // Validación server-side de precios (evita price tampering)
    const expectedSubtotal = itemsWithProducts.reduce(
      (acc: number, { item, precioUnit }: ItemWithProduct) =>
        acc + item.cantidad_packs * precioUnit,
      0
    );
    // ── Pedido mínimo + descuento fijo (cliente recurrente / cuenta corriente
    //    simple) — el mínimo puede ser el particular del cliente o el general
    //    del sitio. El descuento fijo, si tiene, se resta del subtotal antes
    //    de comparar contra lo que mandó el cliente (evita price tampering:
    //    el front tiene que haber pedido /api/mi-cuenta/condiciones y
    //    aplicado el mismo descuento para que coincida).
    const esMayorista = items.every((i) => i.tipo_pack !== 'unidad');
    let condicionCliente: {
      monto_minimo_pedido: number | null;
      descuento_fijo_pct: number;
      limite_cuenta_corriente: number;
      saldo_cuenta_corriente: number;
      activo: boolean;
    } | null = null;

    if (user) {
      const { data } = await admin
        .from('clientes_mayoristas')
        .select('monto_minimo_pedido, descuento_fijo_pct, limite_cuenta_corriente, saldo_cuenta_corriente, activo')
        .eq('profile_id', user.id)
        .maybeSingle();
      if (data?.activo) condicionCliente = data;
    }

    const descuentoPct = condicionCliente?.descuento_fijo_pct ?? 0;
    const expectedSubtotalConDescuento = descuentoPct > 0
      ? Math.round(expectedSubtotal * (1 - descuentoPct / 100))
      : expectedSubtotal;

    if (Math.abs(expectedSubtotalConDescuento - subtotal) > 1) {
      return NextResponse.json(
        { error: 'Los precios han cambiado. Por favor, actualizá el carrito.' },
        { status: 409 }
      );
    }

    if (esMayorista) {
      let montoMinimo = condicionCliente?.monto_minimo_pedido ?? 0;
      if (montoMinimo === 0) {
        const { data: settingRow } = await admin
          .from('site_settings')
          .select('valor')
          .eq('clave', 'monto_minimo_pedido')
          .single();
        montoMinimo = settingRow ? Number(settingRow.valor) : 0;
      }
      if (montoMinimo > 0 && subtotal < montoMinimo) {
        const fmt = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n);
        return NextResponse.json(
          { error: `El pedido mínimo es de ${fmt(montoMinimo)}. Te faltan ${fmt(montoMinimo - subtotal)}.` },
          { status: 422 }
        );
      }
    }

    // ── Cuenta corriente: validar cupo disponible antes de crear el pedido ──
    if (formData.metodo_pago === 'cuenta_corriente') {
      if (!condicionCliente || condicionCliente.limite_cuenta_corriente <= 0) {
        return NextResponse.json({ error: 'No tenés cuenta corriente habilitada' }, { status: 403 });
      }
      const disponible = condicionCliente.limite_cuenta_corriente - condicionCliente.saldo_cuenta_corriente;
      if (total > disponible) {
        const fmt = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n);
        return NextResponse.json(
          { error: `Cupo de cuenta corriente insuficiente. Disponible: ${fmt(disponible)}` },
          { status: 422 }
        );
      }
    }

    const { data: order, error: orderErr } = await admin.from('orders').insert({
      user_id:       user?.id ?? null,  // null = invitado
      email:         formData.email,
      nombre:        formData.nombre,
      telefono:      formData.telefono,
      direccion:     formData.tipo_entrega === 'retiro' ? 'Retiro en local' : formData.direccion,
      ciudad:        formData.tipo_entrega === 'retiro' ? 'Retiro en local' : formData.ciudad,
      codigo_postal: formData.tipo_entrega === 'retiro' ? '0000'            : formData.codigo_postal,
      notas:         formData.notas ?? null,
      metodo_pago:   formData.metodo_pago,
      tipo_entrega:  formData.tipo_entrega,
      tipo_venta:    items.some((i) => i.tipo_pack === 'unidad') ? 'minorista' : 'mayorista',
      subtotal,
      costo_envio,
      total,
      estado: formData.metodo_pago === 'cuenta_corriente' ? 'pagado' : 'pendiente',
      codigo_retiro: formData.tipo_entrega === 'retiro' ? generarCodigoRetiro() : null,
      // ── Identidad de quien retira (solo aplica a retiro en local) ──────
      retiro_dni_titular:    formData.tipo_entrega === 'retiro' ? formData.retiro_dni_titular || null : null,
      retiro_retira_tercero: formData.tipo_entrega === 'retiro' ? !!formData.retiro_retira_tercero : false,
      retiro_tercero_nombre: formData.tipo_entrega === 'retiro' && formData.retiro_retira_tercero ? formData.retiro_tercero_nombre || null : null,
      retiro_tercero_dni:    formData.tipo_entrega === 'retiro' && formData.retiro_retira_tercero ? formData.retiro_tercero_dni || null : null,
    }).select().single();

    if (orderErr) throw orderErr;

    const { error: itemsErr } = await admin.from('order_items').insert(
      itemsWithProducts.map(({ orderItem }: ItemWithProduct) => ({
        order_id: order.id,
        ...orderItem,
      }))
    );
    if (itemsErr) throw itemsErr;

    // ══════════════════════════════════════════════════════════════════════
    // REGLA DE NEGOCIO 2B — Reserva de stock SOLO para pagos manuales
    // ══════════════════════════════════════════════════════════════════════
    // (Descuenta de product_variants o products según corresponda — ver
    // reservar_stock_orden_manual en sql/schema.sql, ya es variant-aware.)
    if (formData.metodo_pago === 'transferencia') {
      const { data: reserva } = await admin.rpc('reservar_stock_orden_manual', {
        p_order_id: order.id,
      });

      if (!reserva?.success) {
        await admin.from('orders').update({ estado: 'cancelado' }).eq('id', order.id);
        return NextResponse.json(
          {
            error: reserva?.error ?? 'Lo sentimos, el producto ya no se encuentra disponible',
            faltantes: reserva?.faltantes,
          },
          { status: 409 }
        );
      }
    }

    // ── Cuenta corriente: el pedido ya se dio por pagado (estado 'pagado'),
    //    así que también se reserva/descuenta el stock de inmediato (mismo
    //    RPC que transferencia) y se suma el total a la deuda del cliente.
    if (formData.metodo_pago === 'cuenta_corriente') {
      const { data: reserva } = await admin.rpc('reservar_stock_orden_manual', {
        p_order_id: order.id,
      });

      if (!reserva?.success) {
        await admin.from('orders').update({ estado: 'cancelado' }).eq('id', order.id);
        return NextResponse.json(
          {
            error: reserva?.error ?? 'Lo sentimos, el producto ya no se encuentra disponible',
            faltantes: reserva?.faltantes,
          },
          { status: 409 }
        );
      }

      // user siempre existe acá (se validó arriba que condicionCliente no sea null,
      // lo que requiere estar logueado).
      await admin.rpc('sumar_saldo_cuenta_corriente', {
        p_profile_id: user!.id,
        p_monto: total,
        p_order_id: order.id,
        p_concepto: `Pedido #${String(order.id).slice(0, 8).toUpperCase()}`,
      })
        .then(async ({ error }) => {
          if (error) {
            // Fallback si el RPC no existe: update directo (menos seguro ante
            // concurrencia, pero evita dejar el pedido en un estado raro).
            const { data: actual } = await admin
              .from('clientes_mayoristas')
              .select('saldo_cuenta_corriente')
              .eq('profile_id', user!.id)
              .single();
            if (actual) {
              const nuevoSaldo = Number(actual.saldo_cuenta_corriente) + total;
              await admin
                .from('clientes_mayoristas')
                .update({ saldo_cuenta_corriente: nuevoSaldo })
                .eq('profile_id', user!.id);
              // Best-effort: si el RPC no está (DB sin migrar), igual se
              // intenta dejar constancia del movimiento a mano.
              await admin.from('movimientos_cuenta_corriente').insert({
                profile_id: user!.id,
                tipo: 'cargo',
                monto: total,
                saldo_resultante: nuevoSaldo,
                concepto: `Pedido #${String(order.id).slice(0, 8).toUpperCase()}`,
                order_id: order.id,
              }).then(() => {}, () => {});
            }
          }
        });
    }
    // Si metodo_pago === 'mercadopago': no se toca el stock acá — el
    // descuento definitivo ocurre en el webhook al recibir 'approved',
    // vía descontar_stock_seguro (también variant-aware).

    // ✅ Notificar al admin sobre nuevo pedido
    admin
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', order.id)
      .single()
      .then(({ data }) => {
        if (data) {
          sendOrderConfirmationEmail(data as Parameters<typeof sendOrderConfirmationEmail>[0]).catch(console.error);
          import('@/lib/email').then(({ sendAdminOrderStatusEmail }) => {
            sendAdminOrderStatusEmail(
              data as Parameters<typeof sendAdminOrderStatusEmail>[0],
              `🛒 Nuevo pedido #${data.id.slice(0,8).toUpperCase()} — ${data.metodo_pago}`
            ).catch(console.error);
          });
          sendAdminPushNotification({
            title: '🛒 Nuevo pedido pendiente',
            body:  `Pedido #${data.id.slice(0,8).toUpperCase()} de ${data.nombre} (${data.metodo_pago}) — esperando comprobante.`,
            tag:   'order-new',
            data:  { url: '/admin/pedidos' },
          }).catch(console.error);
        }
      });

    return NextResponse.json({ data: order });
  } catch (err: unknown) {
    console.error('Order error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al crear el pedido' },
      { status: 500 }
    );
  }
}