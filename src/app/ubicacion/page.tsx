import { createClient } from '@/lib/supabase/server';
import { getYouTubeEmbedUrl } from '@/utils';
import { PageHero } from '@/components/common/PageHero';
import { AnimateIn } from '@/components/common/AnimateIn';
import { MapPin } from 'lucide-react';
import type { LocationInfo } from '@/types';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Ubicación' };
export const revalidate = 300;

export default async function UbicacionPage() {
  const supabase = await createClient();
  const { data } = await supabase.from('location_info').select('*').single();
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
