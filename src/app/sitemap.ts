import { MetadataRoute } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';
import { env } from '@/env';

export const revalidate = 3600; // Re-generate every hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const appUrl = env.APP_URL || 'https://localhost:3000';
  const now    = new Date();

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: appUrl,                  lastModified: now, changeFrequency: 'daily',   priority: 1.0 },
    { url: `${appUrl}/faq`,         lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${appUrl}/contacto`,    lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${appUrl}/ubicacion`,   lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${appUrl}/buscar`,      lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${appUrl}/politicas`,   lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${appUrl}/terminos`,    lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
  ];

  // Dynamic product pages
  let productPages: MetadataRoute.Sitemap = [];
  try {
    const admin = createAdminClient();
    const { data: products } = await admin
      .from('products')
      .select('slug, updated_at')
      .eq('activo', true)
      .order('updated_at', { ascending: false });

    productPages = (products ?? []).map((p) => ({
      url:             `${appUrl}/productos/${p.slug}`,
      lastModified:    new Date(p.updated_at).toISOString(),
      changeFrequency: 'weekly' as const,
      priority:        0.8,
    }));
  } catch (e) {
    console.error('Sitemap: error fetching products', e);
  }

  return [...staticPages, ...productPages];
}