import { createAdminClient } from '@/lib/supabase/admin';
import { ContactForm } from '@/components/common/ContactForm';
import { PageHero } from '@/components/common/PageHero';
import { AnimateIn } from '@/components/common/AnimateIn';
import { Mail, Phone, Clock, MapPin, Instagram, Facebook } from 'lucide-react';
import type { ContactInfo } from '@/types';

function TikTokIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z"/>
    </svg>
  );
}

export const metadata = { title: 'Contacto' };
export const revalidate = 300;

export default async function ContactoPage() {
  const admin = createAdminClient();
  const { data } = await admin.from('contact_info').select('*').single();
  const info = data as ContactInfo | null;

  return (
    <>
      <PageHero
        eyebrow="¿Hablamos?"
        title="Contacto"
        description="Estamos para ayudarte. Escribinos y te respondemos a la brevedad."
      />
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="grid gap-10 md:grid-cols-2">
          {/* Info */}
          <AnimateIn className="space-y-6">
            <div className="space-y-3">
              {info?.email && (
                <a href={`mailto:${info.email}`} className="group flex items-center gap-3 rounded-xl border border-border p-3 text-sm transition-colors hover:border-brand-400 hover:bg-surface-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-500 transition-colors group-hover:bg-brand-500 group-hover:text-white dark:bg-brand-900/40">
                    <Mail size={16} />
                  </span>
                  {info.email}
                </a>
              )}
              {info?.telefono && (
                <a href={`tel:${info.telefono}`} className="group flex items-center gap-3 rounded-xl border border-border p-3 text-sm transition-colors hover:border-brand-400 hover:bg-surface-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-500 transition-colors group-hover:bg-brand-500 group-hover:text-white dark:bg-brand-900/40">
                    <Phone size={16} />
                  </span>
                  {info.telefono}
                </a>
              )}
              {info?.horario && (
                <div className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-500 dark:bg-brand-900/40">
                    <Clock size={16} />
                  </span>
                  {info.horario}
                </div>
              )}
              {info?.direccion && (
                <div className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-500 dark:bg-brand-900/40">
                    <MapPin size={16} />
                  </span>
                  {info.direccion}
                </div>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              {info?.instagram && (
                <a href={`https://instagram.com/${info.instagram.replace('@','')}`}
                  target="_blank" rel="noopener noreferrer"
                  className="btn-secondary px-4 py-2 text-sm flex items-center gap-2">
                  <Instagram size={16} /> Instagram
                </a>
              )}
              {info?.facebook && (
                <a href={info.facebook} target="_blank" rel="noopener noreferrer"
                  className="btn-secondary px-4 py-2 text-sm flex items-center gap-2">
                  <Facebook size={16} /> Facebook
                </a>
              )}
              {info?.tiktok && (
                <a href={info.tiktok} target="_blank" rel="noopener noreferrer"
                  className="btn-secondary px-4 py-2 text-sm flex items-center gap-2">
                  <TikTokIcon size={16} /> TikTok
                </a>
              )}
            </div>
          </AnimateIn>

          {/* Form */}
          <AnimateIn delay={0.1}>
            <ContactForm />
          </AnimateIn>
        </div>
      </div>
    </>
  );
}