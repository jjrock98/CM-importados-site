import { MetadataRoute } from 'next';
import { env } from '@/env';

export default function robots(): MetadataRoute.Robots {
  const appUrl = env.APP_URL || 'https://localhost:3000';

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/'],
        disallow: [
          '/admin',
          '/admin/*',
          '/api/*',
          '/auth/*',
          '/carrito',
          '/checkout',
          '/checkout/*',
          '/completar-perfil',
          '/mis-pedidos',
          '/mis-pedidos/*',
          '/minorista', // canal desactivado — no indexar
          '/pago',
          '/pago/*', // páginas de resultado de pago — sin contenido útil para buscar
          '/pedido-confirmado',
          '/perfil',
          '/subir-comprobante',
          '/pago-exitoso',
          '/wishlist', // personal por usuario — requiere login
          '/mantenimiento',
        ],
      },
      // Rastreadores de IA y de SEO que descargan el sitio completo sin
      // aportar ventas (consumen ancho de banda). Solo los respetan los bots
      // "educados": para los maliciosos está el Firewall de Vercel.
      // OJO: NO bloquear facebookexternalhit / WhatsApp / Googlebot, son los
      // que generan las vistas previas de links y el posicionamiento.
      {
        userAgent: [
          'GPTBot', 'ChatGPT-User', 'OAI-SearchBot', 'CCBot', 'ClaudeBot',
          'anthropic-ai', 'Google-Extended', 'PerplexityBot', 'Bytespider',
          'Amazonbot', 'Applebot-Extended', 'AhrefsBot', 'SemrushBot',
          'MJ12bot', 'DotBot', 'PetalBot', 'DataForSeoBot', 'ImagesiftBot',
        ],
        disallow: ['/'],
      },
    ],
    sitemap: `${appUrl}/sitemap.xml`,
    host:    appUrl,
  };
}