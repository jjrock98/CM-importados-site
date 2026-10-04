/** @type {import('next').NextConfig} */
const { storefrontCsp } = require('./src/lib/csp');

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
  // La política vive en src/lib/csp.js (compartida con el proxy del panel admin).
  { key: 'Content-Security-Policy', value: storefrontCsp() },
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

    // ✅ FIX PageSpeed — "JavaScript antiguo" (14 KiB).
    // Next.js mete SIEMPRE `next/dist/build/polyfills/polyfill-module` en el
    // bundle del cliente (Array.prototype.at/flat/flatMap, Object.fromEntries,
    // Object.hasOwn, String.prototype.trimStart/trimEnd, etc.), sin mirar el
    // `browserslist`. Este proyecto compila con Turbopack (default de
    // `next build` en Next 16), así que la config `webpack:` que había antes
    // NUNCA se ejecutaba. Además, ese alias tampoco habría funcionado con
    // webpack: Next importa el polyfill con una ruta RELATIVA
    // (`../build/polyfills/polyfill-module` desde client/app-globals.js) y
    // `resolve.alias` solo matchea el nombre del import, no la ruta resuelta.
    // Solución: una regla de Turbopack que vacía ese archivo puntual por su
    // ruta. Verificado con un build real: los chunks ya no contienen los polyfills.
    rules: {
      'polyfill-module.js': {
        condition: {
          path: /next[\\/]dist[\\/]build[\\/]polyfills[\\/]polyfill-module\.js$/,
        },
        loaders: [require.resolve('./scripts/empty-module-loader.js')],
        as: '*.js',
      },
    },
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
  // marcaba PageSpeed evitando que Webpack/Turbopack empaqueten el
  // archivo barrel completo de estas librerías — Next.js ya lo hace
  // automático para 'lucide-react' desde la v13.5, pero se lo deja
  // explícito acá por las dudas (no tiene costo si ya estaba on), y se
  // suma 'recharts', que solo se usa en /admin (SalesChart.tsx).
  //
  // ✅ FIX PageSpeed (segunda vuelta) — lo de arriba (92 KiB en su
  // momento) no era la causa completa: PageSpeed seguía marcando ~94 KiB
  // de JS sin usar en los mismos 3 chunks. La causa real: varios
  // componentes (AnimateIn, PageHero, HeroVisual, MinoristaGrid)
  // importaban el objeto `motion` de framer-motion — eso empaqueta el
  // motor ENTERO de la librería (gestos, drag, layout animations), aunque
  // acá solo se usan fades/slides/scale simples. Se migró todo ese código
  // a `LazyMotion` + `m.*` (ver src/components/common/MotionProvider.tsx),
  // que carga solo el subconjunto chico (`domAnimation`) que el sitio
  // realmente necesita. Sumar 'framer-motion' acá es un extra menor sobre
  // ese fix — no reemplaza la migración a `m.*`, que es la que hace la
  // diferencia real.
  experimental: {
    inlineCss: true,
    optimizePackageImports: ['lucide-react', 'recharts', 'framer-motion'],
  },
};

module.exports = nextConfig;