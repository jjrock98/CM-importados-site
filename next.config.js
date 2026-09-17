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
  // ✅ FIX: Next detectó un package-lock.json en C:\Users\Caro (fuera del
  // repo de este proyecto, en C:\Users\Caro\Documents\proyectoNuevoclaude\
  // Ecommerce) y no sabía cuál raíz usar para resolver el workspace. Fijarla
  // explícita saca el warning y evita que Turbopack adivine mal si en algún
  // momento hay OTRO package-lock.json/yarn.lock más arriba en el árbol de
  // carpetas de esa PC.
  turbopack: {
    root: __dirname,
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'via.placeholder.com' },
    ],
    formats: ['image/avif', 'image/webp'],
  },

  async redirects() {
    return [
      // ✅ Redirects de productos renombrados: el slug (URL) de estos
      // productos cambió al editar el nombre, dejando la URL vieja
      // indexada por Google apuntando a nada (Soft 404). Un 301 acá
      // conserva el link/SEO viejo mandando al producto actual, sin
      // tocar el nombre ni el slug actuales del producto.
      { source: '/productos/ojotas-adidas',          destination: '/productos/ojotas-slide-adidas-hombre-faja-deportivas', permanent: true },
      { source: '/productos/ojotas-jordan',           destination: '/productos/ojotas-slides-jordan-deportivas-faja-ancha', permanent: true },
      { source: '/productos/ojotas-nike-air-de-mujer', destination: '/productos/ojotas-slide-nike-air-con-relieve',          permanent: true },
    ];
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

  // ✅ FIX PageSpeed — "Solicitudes que bloquean el renderizado" (150ms)
  // y parte del retraso del LCP: el CSS global se estaba sirviendo como
  // <link rel="stylesheet"> externo, lo que agrega un round-trip antes
  // de poder pintar cualquier cosa. `inlineCss` (Next 15+, App Router)
  // reemplaza esos <link> por <style> inline en el <head> — nada que
  // descargar antes del primer pintado. Sigue siendo "experimental" en
  // Next 16, pero es la única opción soportada en App Router: la vieja
  // `experimental.optimizeCss` (basada en critters) NUNCA funcionó acá
  // porque critters necesita el HTML ya renderizado completo, algo
  // incompatible con el streaming que usa el App Router.
  // No hace falta instalar ningún paquete nuevo (a diferencia de
  // `optimizeCss`, esto no depende de critters).
  // CSP: no hace falta tocar `style-src` en securityHeaders de arriba,
  // ya tiene 'unsafe-inline' agregado por next/font.
  //
  // Sumado a esto: `optimizePackageImports` reduce el JS "no usado" que
  // marcaba PageSpeed (92 KiB) evitando que Webpack/Turbopack empaqueten
  // el archivo barrel completo de estas librerías — Next.js ya lo hace
  // automático para 'lucide-react' desde la v13.5, pero se lo deja
  // explícito acá por las dudas (no tiene costo si ya estaba on) y se
  // suma 'recharts', que solo se usa en /admin (SalesChart.tsx) y antes
  // se resolvía completo por el mismo motivo.
  experimental: {
    inlineCss: true,
    optimizePackageImports: ['lucide-react', 'recharts'],
  },
};

module.exports = nextConfig;