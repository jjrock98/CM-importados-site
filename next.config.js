/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control',  value: 'on' },
  { key: 'X-Frame-Options',         value: 'DENY' },
  { key: 'X-Content-Type-Options',  value: 'nosniff' },
  { key: 'Referrer-Policy',         value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',      value: 'camera=(), microphone=(), geolocation=()' },
  {
    key:   'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://sdk.mercadopago.com https://embed.tawk.to https://va.vercel-scripts.com https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://embed.tawk.to",
      // ✅ FIX: se agregan los dominios de tawk.to — su script inyecta la
      // fuente de íconos del widget (@font-face) directo en el <head> del
      // documento principal, NO adentro del iframe embed.tawk.to. Al no
      // estar permitido ese origen acá, el navegador bloqueaba la fuente
      // en TODOS los dispositivos por igual (por eso el bug se repetía
      // igual en el celular y en la PC, en redes distintas: lo bloqueaba
      // el CSP del lado del navegador, no la red) y los íconos del chat
      // se veían como cuadrados vacíos (glifo faltante).
      "font-src 'self' https://fonts.gstatic.com https://embed.tawk.to https://*.tawk.to",
      "img-src 'self' data: blob: https://*.supabase.co https://lh3.googleusercontent.com https://*.tawk.to",
      "frame-src 'self' https://www.mercadopago.com https://www.mercadopago.com.ar https://www.youtube.com https://www.google.com https://tawk.to https://embed.tawk.to https://challenges.cloudflare.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.mercadopago.com https://*.tawk.to wss://*.tawk.to https://challenges.cloudflare.com",
      "media-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];

const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'via.placeholder.com' },
    ],
    formats: ['image/avif', 'image/webp'],
  },

  async headers() {
    return [
      { source: '/(.*)',               headers: securityHeaders },
      { source: '/api/webhooks/:path*', headers: [{ key: 'Cache-Control', value: 'no-store' }, ...securityHeaders] },
    ];
  },

  poweredByHeader: false,
  compress:        true,
  reactStrictMode: true,
  // ✅ Next 16: swcMinify ya es el comportamiento por defecto, no se
  // declara más; serverComponentsExternalPackages se renombró a
  // serverExternalPackages y se movió fuera de "experimental".
  serverExternalPackages: ['@supabase/supabase-js'],
};

module.exports = nextConfig;