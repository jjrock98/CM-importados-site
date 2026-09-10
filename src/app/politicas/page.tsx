import type { Metadata } from 'next';
import { env } from '@/env';
import { PageHero } from '@/components/common/PageHero';
export const metadata: Metadata = {
  title:       'Políticas de privacidad',
  alternates:  { canonical: `${env.APP_URL}/politicas` },
  openGraph: {
    title: 'Políticas de privacidad',
    url:   `${env.APP_URL}/politicas`,
    type:  'website',
  },
};
export default function PoliticasPage() {
  return (
    <>
      <PageHero eyebrow="Legal" title="Política de privacidad" description="Última actualización: enero 2025." />
      <div className="mx-auto max-w-3xl px-4 py-12 prose prose-sm dark:prose-invert">
      <h2>Información que recopilamos</h2>
      <p>Recopilamos la información que nos proporcionás al registrarte: nombre, email y dirección de entrega. También procesamos datos de pago a través de Mercado Pago, que cuenta con certificaciones de seguridad propias.</p>
      <h2>Uso de la información</h2>
      <p>Utilizamos tus datos exclusivamente para procesar pedidos, enviarte actualizaciones sobre tu compra y mejorar nuestros servicios. No vendemos ni compartimos tu información con terceros salvo para completar tu compra (servicio de correo, Mercado Pago).</p>
      <h2>Seguridad de pagos</h2>
      <p>Los pagos son procesados íntegramente por Mercado Pago S.A., que cumple con los estándares de seguridad PCI-DSS. Nosotros nunca almacenamos datos de tarjetas de crédito o débito.</p>
      <h2>Cookies</h2>
      <p>Usamos cookies esenciales para el funcionamiento del carrito de compras y la sesión de usuario. También usamos cookies de análisis anónimas (Vercel Analytics) para mejorar la experiencia. No usamos cookies de seguimiento publicitario de terceros.</p>
      <h2>Retención de datos</h2>
      <p>Conservamos tus datos de pedidos por el tiempo necesario para cumplir obligaciones legales y fiscales. Podés solicitar la eliminación de tu cuenta y datos personales en cualquier momento contactándonos.</p>
      <h2>Tus derechos</h2>
      <p>Tenés derecho a acceder, rectificar y eliminar tus datos personales. Para ejercer estos derechos, contactanos desde la sección <a href="/contacto">Contacto</a>.</p>
      </div>
    </>
  );
}