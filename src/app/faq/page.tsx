import type { Metadata } from 'next';
import { FaqAccordion } from './FaqAccordion';
import { FAQS } from './faqs-data';
import { PageHero } from '@/components/common/PageHero';

export const metadata: Metadata = {
  title: 'Preguntas frecuentes',
  description: 'Respondemos todas tus dudas sobre envíos, métodos de pago, packs y políticas de cambio.',
  alternates: { canonical: `${process.env.NEXT_PUBLIC_APP_URL}/faq` },
  openGraph: {
    title:       'Preguntas frecuentes',
    description: 'Respondemos todas tus dudas sobre envíos, métodos de pago, packs y políticas de cambio.',
    type:        'website',
  },
};

export default function FAQPage() {
  // ✅ JSON-LD FAQPage para que Google (Rich Results + AI Overviews/Modo
  // IA) y otros motores puedan extraer cada pregunta con su respuesta de
  // forma estructurada. FAQS viene de ./faqs-data (sin 'use client'), no
  // del componente del acordeón — ver el comentario en ese archivo sobre
  // por qué importar datos desde un módulo 'use client' rompía el build.
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  };

  return (
    <>
      {/* Mismo patrón de escape ya usado en Breadcrumbs.tsx y
          productos/[slug]/page.tsx: JSON.stringify ya escapa comillas,
          y el .replace evita que un '<' corte la etiqueta <script>. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, '\\u003c') }}
      />
      <PageHero
        eyebrow="Centro de ayuda"
        title="Preguntas frecuentes"
        description="Todo lo que necesitás saber antes de comprar."
      />
      <div className="mx-auto max-w-3xl px-4 py-12">
        <FaqAccordion />
      </div>
    </>
  );
}