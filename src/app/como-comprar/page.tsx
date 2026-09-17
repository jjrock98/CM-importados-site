import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ShieldCheck, Truck, Store, Bus, Building2, Banknote, CreditCard, CheckCircle2 } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { PageHero } from '@/components/common/PageHero';
import { AnimateIn } from '@/components/common/AnimateIn';
import type { BankInfo } from '@/types';
import { env } from '@/env';

export const metadata: Metadata = {
  title:       'Cómo comprar',
  description: 'Guía paso a paso de cómo comprar mayorista: métodos de pago, envío, retiro en local y entrega en micro.',
  alternates:  { canonical: `${env.APP_URL}/como-comprar`, languages: { 'es-AR': `${env.APP_URL}/como-comprar`, 'x-default': `${env.APP_URL}/como-comprar` } },
  openGraph: {
    title:       'Cómo comprar',
    description: 'Guía paso a paso de cómo comprar mayorista: métodos de pago, envío, retiro en local y entrega en micro.',
    url:         `${env.APP_URL}/como-comprar`,
    type:        'website',
  },
};
export const revalidate = 300;

function StepList({ steps }: { steps: ReactNode[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3 text-sm leading-relaxed">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-xs font-bold text-brand-600">
            {i + 1}
          </span>
          <span className="text-muted">{step}</span>
        </li>
      ))}
    </ol>
  );
}

function MetodoCard({ icon, titulo, badge, steps }: { icon: ReactNode; titulo: string; badge?: string; steps: ReactNode[] }) {
  return (
    <div className="card p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-brand-600">
          {icon}
        </div>
        <h3 className="font-semibold">{titulo}</h3>
        {badge && (
          <span className="ml-auto shrink-0 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950/40 dark:text-green-400">
            {badge}
          </span>
        )}
      </div>
      <StepList steps={steps} />
    </div>
  );
}

export default async function ComoComprarPage() {
  const admin = createAdminClient();
  const { data } = await admin.from('bank_info').select('*').single();
  const banco = data as BankInfo | null;

  const datosBancarios = banco?.cbu || banco?.alias
    ? <>Te mostramos el CBU{banco.alias ? ` (o alias: “${banco.alias}”)` : ''} de {banco.titular ?? 'nuestra cuenta'}{banco.banco ? ` en ${banco.banco}` : ''}.</>
    : 'Te mostramos el CBU/alias de nuestra cuenta bancaria.';

  return (
    <>
      <PageHero
        eyebrow="Comprá con confianza"
        title="Cómo comprar"
        description="Elegís cómo recibirlo y cómo pagarlo — vas a ver todas las combinaciones disponibles según lo que elijas."
        icon={<ShieldCheck size={28} />}
      />

      <div className="mx-auto max-w-4xl px-4 py-12 space-y-16">

        {/* ── Para quien compra por primera vez ─────────────────────── */}
        <AnimateIn>
          <section className="card border-2 border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/10 p-6">
            <div className="flex items-start gap-3">
              <Store size={22} className="mt-0.5 shrink-0 text-green-600" />
              <div>
                <h2 className="mb-1 font-semibold text-green-800 dark:text-green-400">
                  ¿Primera vez comprando acá?
                </h2>
                <p className="text-sm leading-relaxed text-muted">
                  Sabemos que hacer una transferencia grande sin conocer al vendedor genera dudas. Por eso, si podés
                  acercarte, la forma más segura es <strong className="text-foreground">retirar en el local y pagar en efectivo recién
                  cuando ves la mercadería</strong> — no adelantás nada. Si no podés venir, la transferencia queda
                  confirmada recién cuando revisamos tu comprobante — nunca se despacha nada a ciegas. Más abajo
                  están el paso a paso de las dos, y del resto de las opciones.
                </p>
              </div>
            </div>
          </section>
        </AnimateIn>

        {/* ── Tipos de entrega ──────────────────────────────────────── */}
        <AnimateIn delay={0.05}>
          <section>
            <h2 className="mb-6 text-xl font-semibold">1. Elegís cómo lo recibís</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="card p-5 text-center">
                <Truck size={24} className="mx-auto mb-2 text-brand-500" />
                <p className="font-medium text-sm">Envío a domicilio</p>
                <p className="mt-1 text-xs text-muted">Lo recibís en tu dirección. Se coordina por WhatsApp el costo y el tiempo.</p>
              </div>
              <div className="card p-5 text-center">
                <Store size={24} className="mx-auto mb-2 text-green-600" />
                <p className="font-medium text-sm">Retirar en el local</p>
                <p className="mt-1 text-xs text-muted">Sin costo de envío. Lunes a viernes de 9 a 18hs, con código de retiro + DNI.</p>
              </div>
              <div className="card p-5 text-center">
                <Bus size={24} className="mx-auto mb-2 text-amber-600" />
                <p className="font-medium text-sm">Entrega en micro</p>
                <p className="mt-1 text-xs text-muted">Solo Feria La Salada: Punta Mogote, Urkupiña u Ocean.</p>
              </div>
            </div>
          </section>
        </AnimateIn>

        {/* ── Envío a domicilio ─────────────────────────────────────── */}
        <AnimateIn delay={0.1}>
          <section>
            <h2 className="mb-2 text-xl font-semibold flex items-center gap-2"><Truck size={20} className="text-brand-500" /> Envío a domicilio</h2>
            <p className="mb-6 text-sm text-muted">Disponible con estos métodos de pago (el efectivo no aplica a envíos):</p>
            <div className="grid gap-4 md:grid-cols-2">
              <MetodoCard
                icon={<Building2 size={18} />}
                titulo="Transferencia bancaria"
                badge="Método principal"
                steps={[
                  'Completás tus datos de envío y confirmás el pedido.',
                  datosBancarios,
                  'Transferís el importe exacto del pedido.',
                  'Subís la foto o PDF del comprobante desde la página que te aparece después.',
                  'Confirmamos el pago (normalmente en pocas horas) y coordinamos el envío por WhatsApp.',
                ]}
              />
              <MetodoCard
                icon={<CreditCard size={18} />}
                titulo="Cuenta corriente"
                badge="Clientes de confianza"
                steps={[
                  'Solo la ven clientes recurrentes y de confianza, con cuenta corriente habilitada por nosotros, y dentro de su cupo disponible.',
                  'Al confirmar, el importe se descuenta directo de tu cupo — el pedido queda pagado al instante.',
                  'No subís comprobante ni esperás confirmación.',
                  'La cuenta se salda después, según lo acordado con vos.',
                ]}
              />
            </div>
          </section>
        </AnimateIn>

        {/* ── Retirar en local ──────────────────────────────────────── */}
        <AnimateIn delay={0.15}>
          <section>
            <h2 className="mb-2 text-xl font-semibold flex items-center gap-2"><Store size={20} className="text-green-600" /> Retirar en el local</h2>
            <p className="mb-6 text-sm text-muted">La única opción de entrega que suma el pago en efectivo — ideal si es tu primera compra.</p>
            <div className="grid gap-4 md:grid-cols-2">
              <MetodoCard
                icon={<Banknote size={18} />}
                titulo="Efectivo"
                badge="Sin adelantar nada"
                steps={[
                  'Elegís "Retirar en local" y método "Pago en efectivo".',
                  'Completás tu DNI (y el de quien retire, si no sos vos) y confirmás — el pedido queda reservado, sin pagar todavía.',
                  'Te avisamos cuando esté listo para retirar.',
                  'Vas al local de lunes a viernes de 9 a 18hs, revisás la mercadería tranquilo.',
                  'Recién ahí pagás en efectivo, mostrando el código de retiro + tu DNI.',
                ]}
              />
              <MetodoCard
                icon={<Building2 size={18} />}
                titulo="Transferencia bancaria"
                steps={[
                  'Confirmás el pedido eligiendo "Retirar en local" y "Transferencia".',
                  datosBancarios,
                  'Transferís y subís el comprobante.',
                  'Confirmamos el pago y te avisamos cuando esté listo para retirar (con tu código + DNI).',
                ]}
              />
              <MetodoCard
                icon={<CreditCard size={18} />}
                titulo="Cuenta corriente"
                badge="Clientes de confianza"
                steps={[
                  'Se descuenta de tu cupo disponible al confirmar — pedido pagado al instante.',
                  'Te avisamos cuando esté listo para retirar (con tu código + DNI).',
                ]}
              />
            </div>
          </section>
        </AnimateIn>

        {/* ── Entrega en micro ──────────────────────────────────────── */}
        <AnimateIn delay={0.2}>
          <section>
            <h2 className="mb-2 text-xl font-semibold flex items-center gap-2"><Bus size={20} className="text-amber-600" /> Entrega en micro (Feria La Salada)</h2>
            <p className="mb-6 text-sm text-muted">
              Elegís una de 3 terminales — <strong className="text-foreground">Punta Mogote, Urkupiña u Ocean</strong> — e indicás
              el micro/empresa de transporte y quién recibe el pedido en destino. Solo se ofrece transferencia y efectivo:
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <MetodoCard
                icon={<Building2 size={18} />}
                titulo="Transferencia bancaria"
                steps={[
                  'Elegís "Entrega en micro", la terminal, y completás empresa de transporte + quién recibe.',
                  datosBancarios,
                  'Transferís y subís el comprobante.',
                  'Confirmamos el pago y despachamos el pedido en el micro que indicaste.',
                ]}
              />
              <MetodoCard
                icon={<Banknote size={18} />}
                titulo="Efectivo"
                steps={[
                  'Elegís "Entrega en micro", la terminal, y completás empresa de transporte + quién recibe.',
                  'Confirmás sin pagar todavía — el pedido queda reservado.',
                  'Pagás en efectivo al despachar el pedido en el micro elegido.',
                ]}
              />
            </div>
          </section>
        </AnimateIn>

        {/* ── Cierre / confianza ────────────────────────────────────── */}
        <AnimateIn delay={0.25}>
          <section className="card p-6 text-center">
            <CheckCircle2 size={24} className="mx-auto mb-3 text-brand-500" />
            <p className="text-sm text-muted leading-relaxed">
              ¿Todavía tenés dudas? Podés escribirnos por WhatsApp antes de pagar, revisar nuestra{' '}
              <Link href="/ubicacion" className="text-brand-600 hover:underline">ubicación</Link> o leer las{' '}
              <Link href="/faq" className="text-brand-600 hover:underline">preguntas frecuentes</Link>.
            </p>
          </section>
        </AnimateIn>

      </div>
    </>
  );
}