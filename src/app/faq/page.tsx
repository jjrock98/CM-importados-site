import type { Metadata } from 'next';
import { FaqAccordion } from './FaqAccordion';
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
  return (
    <>
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
