import { createAdminClient } from '@/lib/supabase/admin';
import { getYouTubeEmbedUrl } from '@/utils';
import { PageHero } from '@/components/common/PageHero';
import { AnimateIn } from '@/components/common/AnimateIn';
import { MapPin } from 'lucide-react';
import type { LocationInfo } from '@/types';
import type { Metadata } from 'next';
import { env } from '@/env';

export const metadata: Metadata = {
  title:       'Ubicación',
  description: 'Encontrá cómo llegar a nuestro local, horarios de atención y videos de la zona.',
  alternates:  { canonical: `${env.APP_URL}/ubicacion` },
  openGraph: {
    title:       'Ubicación',
    description: 'Encontrá cómo llegar a nuestro local, horarios de atención y videos de la zona.',
    url:         `${env.APP_URL}/ubicacion`,
    type:        'website',
    // ✅ FIX: el openGraph de esta página reemplaza por completo (no
    // fusiona) al del layout raíz, así que perdía el og:image de ahí.
    // Se repite acá el mismo fallback estático que usa el layout.
    images: [{
      url:    `${env.APP_URL}/og-default.png?v=2`,
      width:  1200,
      height: 630,
      alt:    'Ubicación',
    }],
  },
  twitter: {
    card:        'summary_large_image',
    title:       'Ubicación',
    description: 'Encontrá cómo llegar a nuestro local, horarios de atención y videos de la zona.',
    images:      [`${env.APP_URL}/og-default.png`],
  },
};
export const revalidate = 300;

export default async function UbicacionPage() {
  const admin = createAdminClient();
  const { data } = await admin.from('location_info').select('*').single();
  const info = data as LocationInfo | null;

  return (
    <>
      <PageHero
        eyebrow="Visitanos"
        title="Ubicación"
        description={info?.descripcion}
        icon={<MapPin size={28} />}
      />
      <div className="mx-auto max-w-5xl px-4 py-12 space-y-14">
        {/* Map */}
        {info?.mapa_iframe_url && (
          <AnimateIn>
            <section>
              <h2 className="text-xl font-semibold mb-4">Cómo llegar</h2>
              <div className="video-container shadow-lg">
                <iframe
                  src={info.mapa_iframe_url}
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Mapa de ubicación"
                />
              </div>
            </section>
          </AnimateIn>
        )}

        {/* Videos */}
        {(info?.video1_url || info?.video2_url) && (
          <AnimateIn delay={0.1}>
            <section>
              <h2 className="text-xl font-semibold mb-6">Videos del lugar</h2>
              <div className="grid gap-8 md:grid-cols-2">
                {info?.video1_url && (
                  <div>
                    {info.video1_titulo && <h3 className="font-medium mb-3">{info.video1_titulo}</h3>}
                    <div className="video-container shadow-md">
                      <iframe
                        src={getYouTubeEmbedUrl(info.video1_url)}
                        title={info.video1_titulo ?? 'Video 1'}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  </div>
                )}
                {info?.video2_url && (
                  <div>
                    {info.video2_titulo && <h3 className="font-medium mb-3">{info.video2_titulo}</h3>}
                    <div className="video-container shadow-md">
                      <iframe
                        src={getYouTubeEmbedUrl(info.video2_url)}
                        title={info.video2_titulo ?? 'Video 2'}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  </div>
                )}
              </div>
            </section>
          </AnimateIn>
        )}
      </div>
    </>
  );
}