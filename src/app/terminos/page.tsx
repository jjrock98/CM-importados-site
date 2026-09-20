import type { Metadata } from 'next';
import { env } from '@/env';
import { PageHero } from '@/components/common/PageHero';
export const metadata: Metadata = {
  title:       'Términos y condiciones',
  description: 'Conocé nuestras políticas de venta exclusiva por packs de docena o media docena, validación de transferencias y cambios por fallas.',
  alternates:  { canonical: `${env.APP_URL}/terminos`, languages: { 'es-AR': `${env.APP_URL}/terminos`, 'x-default': `${env.APP_URL}/terminos` } },
  openGraph: {
    siteName:    'MC Importados',
    locale:      'es_AR',
    title:       '📝 Términos y Condiciones | MC Importados',
    description: 'Conocé nuestras políticas de venta por packs, validación de transferencias y cambios por fallas.',
    url:         `${env.APP_URL}/terminos`,
    type:        'website',
    images: [{
      url:    `${env.APP_URL}/og-terminos.png`,
      width:  1200,
      height: 630,
      alt:    'Términos y Condiciones — MC Importados',
    }],
  },
  twitter: {
    card:        'summary_large_image',
    title:       '📝 Términos y Condiciones | MC Importados',
    description: 'Políticas de venta por packs, validación de transferencias y cambios por fallas.',
    images:      [`${env.APP_URL}/og-terminos.png`],
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
      <p>Aceptamos transferencia bancaria, pago en efectivo al retirar en el local o al despachar en micro, y cuenta corriente para clientes recurrentes y de confianza. En caso de transferencia, el pedido se confirma una vez validado el comprobante por nuestro equipo.</p>
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