import type { Metadata } from 'next';
import { env } from '@/env';
import { PageHero } from '@/components/common/PageHero';
export const metadata: Metadata = {
  title:       'Políticas de privacidad',
  description: 'Conocé cómo protegemos tus datos de registro, comprobantes de pago y el uso seguro de cookies esenciales en nuestra tienda.',
  alternates:  { canonical: `${env.APP_URL}/politicas`, languages: { 'es-AR': `${env.APP_URL}/politicas`, 'x-default': `${env.APP_URL}/politicas` } },
  openGraph: {
    siteName:    'MC Importados',
    locale:      'es_AR',
    title:       '🔒 Políticas de Privacidad | MC Importados',
    description: 'Conocé cómo protegemos tus datos de registro, comprobantes de pago y el uso de cookies esenciales.',
    url:         `${env.APP_URL}/politicas`,
    type:        'website',
    images: [{
      url:    `${env.APP_URL}/og-politicas.png`,
      width:  1200,
      height: 630,
      alt:    'Políticas de Privacidad — MC Importados',
    }],
  },
  twitter: {
    card:        'summary_large_image',
    title:       '🔒 Políticas de Privacidad | MC Importados',
    description: 'Cómo protegemos tus datos de registro, comprobantes de pago y el uso de cookies.',
    images:      [`${env.APP_URL}/og-politicas.png`],
  },
};
export default function PoliticasPage() {
  return (
    <>
      <PageHero eyebrow="Legal" title="Política de privacidad" description="Última actualización: enero 2025." />
      <div className="mx-auto max-w-3xl px-4 py-12 prose prose-sm dark:prose-invert">
      <h2>Información que recopilamos</h2>
      <p>Recopilamos la información que nos proporcionás al registrarte: nombre, email y dirección de entrega. También procesamos el comprobante de transferencia que subís para confirmar tu pago.</p>
      <h2>Uso de la información</h2>
      <p>Utilizamos tus datos exclusivamente para procesar pedidos, enviarte actualizaciones sobre tu compra y mejorar nuestros servicios. No vendemos ni compartimos tu información con terceros salvo para completar tu compra (servicio de correo).</p>
      <h2>Seguridad de pagos</h2>
      <p>Los pagos por transferencia se validan manualmente por nuestro equipo a partir del comprobante que subís. Nunca te pedimos ni almacenamos datos de tarjetas de crédito o débito.</p>
      <h2>Cookies</h2>
      <p>Usamos cookies esenciales para el funcionamiento del carrito de compras y la sesión de usuario. También usamos cookies de análisis anónimas (Vercel Analytics) para mejorar la experiencia. Si aceptás el banner de cookies, además activamos el píxel de Meta (Facebook/Instagram) para medir la efectividad de nuestros anuncios — podés rechazarlo eligiendo &quot;Solo esenciales&quot; en ese banner, o borrando la cookie desde tu navegador para que vuelva a aparecer.</p>
      <h2>Retención de datos</h2>
      <p>Conservamos tus datos de pedidos por el tiempo necesario para cumplir obligaciones legales y fiscales. Podés solicitar la eliminación de tu cuenta y datos personales en cualquier momento contactándonos.</p>
      <h2>Tus derechos</h2>
      <p>Tenés derecho a acceder, rectificar y eliminar tus datos personales. Para ejercer estos derechos, contactanos desde la sección <a href="/contacto">Contacto</a>.</p>
      </div>
    </>
  );
}