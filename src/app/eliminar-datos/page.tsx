import type { Metadata } from 'next';
import { env } from '@/env';
import Link from 'next/link';
import { PageHero } from '@/components/common/PageHero';

export const metadata: Metadata = {
  title:       'Eliminación de datos de usuario',
  alternates:  { canonical: `${env.APP_URL}/eliminar-datos` },
  openGraph: {
    title: 'Eliminación de datos de usuario',
    url:   `${env.APP_URL}/eliminar-datos`,
    type:  'website',
  },
};

export default function EliminarDatosPage() {
  return (
    <>
      <PageHero
        eyebrow="Legal"
        title="Eliminación de datos de usuario"
        description="Cómo solicitar la eliminación de tu cuenta y tus datos personales."
      />
      <div className="mx-auto max-w-3xl px-4 py-12 prose prose-sm dark:prose-invert">
        <p>
          En MC Importados podés solicitar la eliminación completa de tu cuenta y de los datos
          personales asociados a ella (nombre, email, teléfono e historial vinculado a tu perfil)
          en cualquier momento.
        </p>

        <h2>Opción 1: Eliminarla vos mismo/a</h2>
        <p>
          Si tenés una cuenta creada (con email/contraseña o iniciando sesión con Facebook/Google),
          podés eliminarla en simples pasos:
        </p>
        <ol>
          <li>Iniciá sesión en <Link href="/auth/login">tu cuenta</Link>.</li>
          <li>Andá a la sección <Link href="/perfil">Mi perfil</Link>.</li>
          <li>Buscá la opción <strong>&ldquo;Eliminar cuenta&rdquo;</strong> al final de la página.</li>
          <li>Escribí <strong>ELIMINAR</strong> para confirmar.</li>
        </ol>
        <p>
          Tu cuenta y tus datos personales se eliminan de forma inmediata. Si tenías pedidos
          anteriores, el historial de compra se conserva de forma <strong>anonimizada</strong>{' '}
          (sin tu nombre, email ni teléfono) únicamente para fines contables y de garantía —
          nunca podrá volver a asociarse a tu identidad.
        </p>
        <p>
          <em>
            Nota: si tenés un pedido activo (pagado, en preparación o enviado) todavía no
            entregado, el sistema te va a pedir que esperes a que se complete la entrega antes de
            eliminar la cuenta.
          </em>
        </p>

        <h2>Opción 2: Solicitarlo por contacto</h2>
        <p>
          Si preferís que lo hagamos nosotros, o no podés acceder a tu cuenta, escribinos desde{' '}
          <Link href="/contacto">Contacto</Link> o a{' '}
          <a href="mailto:contacto@mitienda.com">contacto@mitienda.com</a> indicando el email con
          el que te registraste. Vamos a confirmar tu identidad y eliminar tus datos dentro de los
          10 días hábiles siguientes a la solicitud.
        </p>

        <h2>Si iniciaste sesión con Facebook</h2>
        <p>
          Además de eliminar tu cuenta acá, podés revocar el acceso de MC Importados a tu perfil
          de Facebook desde la configuración de tu cuenta de Facebook, en{' '}
          <strong>Configuración → Apps y sitios web</strong>.
        </p>

        <h2>Qué se elimina</h2>
        <ul>
          <li>Nombre, email y teléfono de tu perfil.</li>
          <li>Tu acceso de inicio de sesión (email/contraseña o vínculo con Facebook/Google).</li>
        </ul>
      </div>
    </>
  );
}