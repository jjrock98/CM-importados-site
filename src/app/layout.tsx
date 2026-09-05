import type { Metadata, Viewport } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import Script from 'next/script';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'react-hot-toast';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { WhatsAppButton } from '@/components/common/WhatsAppButton';
import { TawkTo } from '@/components/common/TawkTo';
import { CookieConsent } from '@/components/common/CookieConsent';
import { PageProgress } from '@/components/common/PageProgress';
import { EmailVerificationBanner } from '@/components/common/EmailVerificationBanner';
import { BackToTop } from '@/components/common/BackToTop';
import { createClient } from '@/lib/supabase/server';
import type { ContactInfo } from '@/types';
import './globals.css';

const inter    = Inter({ subsets: ['latin'], variable: '--font-body',    display: 'swap' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-display', display: 'swap' });

const appUrl = process.env.NEXT_PUBLIC_APP_URL       ?? 'https://localhost:3000';
const tienda = process.env.NEXT_PUBLIC_TIENDA_NOMBRE ?? 'Mi Tienda';
const fbAppId = process.env.NEXT_PUBLIC_FB_APP_ID;

export const metadata: Metadata = {
  // ── Básico ────────────────────────────────────────────────────────────────
  title: {
    default:  tienda,
    template: `%s | ${tienda}`,
  },
  description: `${tienda} — Comprá nuestros productos en packs de media docena o docena. Envío a domicilio y retiro en local.`,
  metadataBase: new URL(appUrl),

  // ── Keywords ─────────────────────────────────────────────────────────────
  keywords: ['tienda online', 'comprar por pack', 'media docena', 'docena', 'envío a domicilio', tienda],

  // ── Canonical y alternates ────────────────────────────────────────────────
  alternates: { canonical: appUrl },

  // ── Open Graph (Facebook + LinkedIn + WhatsApp preview) ──────────────────
  openGraph: {
    siteName:    tienda,
    locale:      'es_AR',
    type:        'website',
    url:         appUrl,
    title:       tienda,
    description: `${tienda} — Comprá por packs. Envíos y retiro en local.`,
    images: [{
      url:    `${appUrl}/og-default.png`,   // imagen estática de fallback
      width:  1200,
      height: 630,
      alt:    tienda,
    }],
    ...(fbAppId ? { appId: fbAppId } : {}),
  },

  // ── Twitter / X Card ─────────────────────────────────────────────────────
  twitter: {
    card:        'summary_large_image',
    title:       tienda,
    description: `${tienda} — Comprá por packs. Envíos y retiro en local.`,
    images:      [`${appUrl}/og-default.png`],
  },

  // ── Robots ────────────────────────────────────────────────────────────────
  robots: {
    index:           true,
    follow:          true,
    googleBot: {
      index:             true,
      follow:            true,
      'max-image-preview': 'large',
      'max-snippet':       -1,
    },
  },

  // ── Verificación de propiedad ─────────────────────────────────────────────
  // Completar estos valores en Vercel con los de cada servicio:
  verification: {
    google:  process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
    other: {
      // Facebook Domain Verification
      ...(process.env.NEXT_PUBLIC_FB_DOMAIN_VERIFICATION
        ? { 'facebook-domain-verification': [process.env.NEXT_PUBLIC_FB_DOMAIN_VERIFICATION] }
        : {}),
    },
  },

  // ── Manifest / icons ──────────────────────────────────────────────────────
  manifest:  '/manifest.json',
  icons: {
    icon:       [
      { url: '/icons/icon-32.png',  type: 'image/png', sizes: '32x32'  },
      { url: '/icons/icon-192.png', type: 'image/png', sizes: '192x192'},
    ],
    apple:      [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
    shortcut:   '/favicon.ico',
  },
};

export const viewport: Viewport = {
  width:           'device-width',
  initialScale:    1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)',  color: '#0f0f0f' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let contactInfo: ContactInfo | null = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.from('contact_info').select('*').limit(1).single();
    contactInfo = data;
  } catch { /* Footer usa fallbacks de env vars */ }

  return (
    <html lang="es" suppressHydrationWarning
      className={`${inter.variable} ${playfair.variable}`}>
      {/* ✅ FIX hidratación: se sacó el <head> manual que estaba acá. En
          Next.js App Router, declarar un <head> JSX propio en el layout
          raíz entra en conflicto con el <head> que Next.js ya arma solo a
          partir de `metadata` y `next/font` — dos mecanismos gestionando
          el mismo <head> a la vez es exactamente lo que produce el error
          "el servidor renderizó contenido en <head> que el cliente no
          tiene". El script del Pixel se movió a next/script, más abajo,
          que es el método soportado y seguro para hidratación con
          scripts de terceros (no se declara dentro de <head> a mano). */}
      <body className="min-h-screen bg-surface text-foreground antialiased">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <PageProgress />
          <EmailVerificationBanner />
          <Navbar />
          <main id="print-root">{children}</main>
          <Footer contactInfo={contactInfo} />
          <WhatsAppButton />
          <TawkTo />
          <CookieConsent />
          <BackToTop />
          <Toaster position="top-center" toastOptions={{ duration: 4000 }} />
          <Analytics />
          <SpeedInsights />

          {/* Facebook Pixel — opcional, se activa solo si se configura
              NEXT_PUBLIC_FB_PIXEL_ID. next/script con strategy
              "afterInteractive" carga el script después de que la página
              ya es interactiva, sin bloquear el render inicial ni
              interferir con la hidratación (a diferencia de un <script>
              manual dentro de <head>). */}
          {process.env.NEXT_PUBLIC_FB_PIXEL_ID && (
            <Script id="fb-pixel" strategy="afterInteractive">
              {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${process.env.NEXT_PUBLIC_FB_PIXEL_ID}');fbq('track','PageView');`}
            </Script>
          )}
        </ThemeProvider>
      </body>
    </html>
  );
}