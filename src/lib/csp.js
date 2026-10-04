/**
 * Content-Security-Policy compartida entre next.config.js (tienda pública)
 * y src/proxy.ts (panel /admin, con nonce por request).
 *
 * Es un .js en CommonJS a propósito: next.config.js no puede importar
 * TypeScript, y así las listas de dominios permitidos viven en UN solo lugar
 * (antes habría que mantener dos copias que se desincronizan).
 *
 * Las dos políticas son iguales salvo por `script-src`:
 *  - Tienda: 'unsafe-inline' + 'unsafe-eval' (hoy hacen falta para los scripts
 *    inline de Next, Pixel, Clarity y el widget de Tawk; sacarlos obliga a
 *    renderizar TODAS las páginas de forma dinámica, y eso mata el
 *    caché/ISR de la tienda).
 *  - Admin: nonce por request + 'strict-dynamic'. Un <script> inyectado por
 *    un XSS no tiene el nonce, así que el navegador no lo ejecuta. Las
 *    páginas de admin ya son dinámicas (dependen de la sesión), así que acá
 *    el nonce no cuesta nada.
 */

const isDev = process.env.NODE_ENV !== 'production';

const SCRIPT_HOSTS = [
  'https://sdk.mercadopago.com',
  'https://embed.tawk.to',
  'https://va.vercel-scripts.com',
  'https://challenges.cloudflare.com',
  'https://www.clarity.ms',
  'https://scripts.clarity.ms',
  'https://*.googletagmanager.com',
];

function buildCsp(scriptSrc) {
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://embed.tawk.to",
    // tawk.to inyecta la fuente de íconos del widget (@font-face) directo en
    // el <head> del documento principal, no dentro de su iframe: sin estos
    // orígenes los íconos del chat se ven como cuadrados vacíos.
    "font-src 'self' https://fonts.gstatic.com https://embed.tawk.to https://*.tawk.to",
    "img-src 'self' data: blob: https://*.supabase.co https://lh3.googleusercontent.com https://*.tawk.to https://*.clarity.ms https://c.bing.com https://*.google-analytics.com https://*.googletagmanager.com https://*.g.doubleclick.net https://www.google.com",
    "frame-src 'self' https://www.mercadopago.com https://www.mercadopago.com.ar https://www.youtube.com https://www.google.com https://tawk.to https://embed.tawk.to https://challenges.cloudflare.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.mercadopago.com https://*.tawk.to wss://*.tawk.to https://challenges.cloudflare.com https://*.clarity.ms https://c.bing.com https://*.google-analytics.com https://analytics.google.com https://*.analytics.google.com https://*.googletagmanager.com https://*.g.doubleclick.net https://www.google.com",
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // Nadie embebe este sitio en un iframe (los únicos <iframe> de la app son
    // YouTube y Google Maps, de salida). Reemplaza al viejo X-Frame-Options.
    "frame-ancestors 'none'",
  ].join('; ');
}

/** Política de la tienda pública (headers estáticos de next.config.js). */
function storefrontCsp() {
  return buildCsp(`'self' 'unsafe-eval' 'unsafe-inline' ${SCRIPT_HOSTS.join(' ')}`);
}

/** Política estricta con nonce para las páginas de /admin (la arma proxy.ts). */
function adminCsp(nonce) {
  // En desarrollo, React/Next necesitan eval para el refresco en caliente.
  const dev = isDev ? " 'unsafe-eval'" : '';
  return buildCsp(`'self' 'nonce-${nonce}' 'strict-dynamic'${dev}`);
}

module.exports = { storefrontCsp, adminCsp };