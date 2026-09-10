import type { Metadata } from 'next';
import { PageHero } from '@/components/common/PageHero';
export const metadata: Metadata = {
  title:       'Términos y condiciones',
  alternates:  { canonical: `${process.env.NEXT_PUBLIC_APP_URL}/terminos` },
  openGraph: {
    title: 'Términos y condiciones',
    url:   `${process.env.NEXT_PUBLIC_APP_URL}/terminos`,
    type:  'website',
  },
};
export default function TerminosPage() {
  return (
    <>
      <PageHero eyebrow="Legal" title="Términos y condiciones" description="Última actualización: enero 2025." />
      <div className="mx-auto max-w-3xl px-4 py-12 prose prose-sm dark:prose-invert">
      <p>Al usar nuestra tienda aceptás los siguientes términos en su totalidad.</p>
      <h2>Productos y precios</h2>
      <p>Los precios están en pesos argentinos (ARS). Nos reservamos el derecho de modificar precios sin previo aviso. El precio cobrado es el vigente al momento de confirmar el pedido.</p>
      <h2>Modalidad de venta</h2>
      <p>Vendemos exclusivamente en packs de media docena (6 unidades) o docena (12 unidades). No realizamos ventas unitarias.</p>
      <h2>Métodos de pago</h2>
      <p>Aceptamos pagos mediante Mercado Pago (débito, dinero en cuenta y efectivo en puntos de pago — no aceptamos tarjeta de crédito), transferencia bancaria y efectivo al retirar en el local. En caso de transferencia, el pedido se confirma una vez validado el comprobante por nuestro equipo.</p>
      <h2>Proceso de pago con Mercado Pago</h2>
      <p>Al seleccionar Mercado Pago se abrirá una ventana segura gestionada íntegramente por Mercado Pago S.A. Nosotros no almacenamos datos de tarjetas. Los pagos aprobados se confirman automáticamente.</p>
      <h2>Envíos y entregas</h2>
      <p>Los plazos de entrega son aproximados y pueden variar por factores externos. No nos responsabilizamos por demoras del servicio de correo una vez despachado el paquete.</p>
      <h2>Cancelaciones</h2>
      <p>Podés cancelar tu pedido mientras esté en estado &ldquo;Pendiente&rdquo; y antes de que el pago sea procesado, desde la sección Mis Pedidos.</p>
      <h2>Devoluciones</h2>
      <p>Aceptamos devoluciones dentro de los 7 días corridos de recibido el producto, siempre que esté en su estado original y embalaje. El costo del envío de devolución es a cargo del comprador, salvo producto defectuoso.</p>
      <h2>Contacto</h2>
      <p>Para consultas sobre estos términos, contactanos desde la sección <a href="/contacto">Contacto</a>.</p>
      </div>
    </>
  );
}