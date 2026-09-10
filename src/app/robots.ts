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
      {
        userAgent: 'GPTBot',
        disallow: ['/'],
      },
    ],
    sitemap: `${appUrl}/sitemap.xml`,
    host:    appUrl,
  };
}