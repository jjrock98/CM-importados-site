import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://localhost:3000';

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
          '/pedido-confirmado',
          '/perfil',
          '/subir-comprobante',
          '/pago-exitoso',
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
