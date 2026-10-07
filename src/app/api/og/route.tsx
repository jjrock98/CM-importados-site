import { ImageResponse } from 'next/og';
import { env } from '@/env';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

// ✅ 'size' y 'contentType' NO son exports válidos para un route.tsx
// con un handler GET (solo lo son para opengraph-image.tsx / icon.tsx).
// Se usan como constante local pasada directamente a ImageResponse.
const size = { width: 1200, height: 630 };

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const title    = searchParams.get('title')  ?? 'Mi Tienda';
  const subtitle = searchParams.get('subtitle') ?? 'Comprá por packs';
  const price    = searchParams.get('price')  ?? '';
  let   image    = searchParams.get('image')  ?? '';

  // ✅ FIX: si la foto del producto no responde rápido (o no responde),
  // ImageResponse podía colgarse o fallar tratando de bajarla, y
  // WhatsApp/redes se quedaban sin preview. Se chequea antes con un
  // timeout corto — si no contesta a tiempo, se genera la tarjeta sin
  // foto en vez de no generar nada.
  if (image) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const check = await fetch(image, { method: 'HEAD', signal: controller.signal });
      clearTimeout(timeout);
      // Algunos hosts no soportan HEAD (405) — eso no es una falla real,
      // solo un 4xx/5xx claro descarta la imagen.
      if (!check.ok && check.status !== 405) image = '';
    } catch {
      image = '';
    }
  }

  // La foto original puede pesar varios MB; se usa la versión liviana en JPEG
  // de /api/og-photo para que la tarjeta se genere rápido y sin fallar.
  // Solo aplica a fotos del storage de Supabase (las únicas que acepta).
  if (image) {
    try {
      if (new URL(image).hostname.endsWith('.supabase.co')) {
        image = `${req.nextUrl.origin}/api/og-photo?src=${encodeURIComponent(image)}`;
      }
    } catch {
      image = '';
    }
  }

  // ✅ Se renderiza DENTRO de un try/catch y se espera el PNG completo
  // (arrayBuffer) para poder atrapar errores: ImageResponse dibuja de forma
  // diferida, y un fallo ahí devolvía un 500 "FUNCTION_INVOCATION_FAILED"
  // sin dejar rastro. Ahora (1) el motivo real queda en los logs de Vercel,
  // y (2) si falla con la foto se reintenta sin ella: la tarjeta con título
  // y precio SIEMPRE se genera, así Facebook/WhatsApp nunca reciben un error.
  const render = async (img: string, cache: string) => {
    const res = new ImageResponse(
      (
      <div
            style={{
              display:         'flex',
              flexDirection:   'column',
              width:           '100%',
              height:          '100%',
              background:      'linear-gradient(135deg, #fdf8f0 0%, #fff7e6 50%, #fef3c7 100%)',
              fontFamily:      'system-ui, sans-serif',
              padding:         '60px',
              position:        'relative',
            }}
          >
            {/* Background decoration */}
            <div style={{
              position: 'absolute', top: 0, right: 0,
              width: 400, height: 400,
              background: 'radial-gradient(circle, rgba(217,142,30,0.15) 0%, transparent 70%)',
            }} />
    
            <div style={{ display: 'flex', flex: 1, gap: '60px', alignItems: 'center' }}>
              {/* Left content */}
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '20px' }}>
                {/* Brand */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  background: 'rgba(217,142,30,0.1)',
                  borderRadius: '50px', padding: '8px 20px',
                  // ✅ FIX 500: Satori (next/og) no soporta width: 'fit-content' y tiraba
                  // 'Invalid value "fit-content" for "width"' → la imagen nunca se generaba
                  // (Facebook/WhatsApp quedaban sin esta tarjeta). alignSelf logra lo mismo.
                  alignSelf: 'flex-start',
                }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#2c4270' }} />
                  <span style={{ color: '#c07015', fontWeight: 700, fontSize: 18 }}>
                    {process.env.NEXT_PUBLIC_TIENDA_NOMBRE ?? 'Mi Tienda'}
                  </span>
                </div>
    
                {/* Title */}
                <h1 style={{
                  fontSize: title.length > 40 ? 42 : 56,
                  fontWeight: 900,
                  color: '#111827',
                  margin: 0,
                  lineHeight: 1.1,
                  maxWidth: 540,
                }}>
                  {title}
                </h1>
    
                {subtitle && (
                  <p style={{ fontSize: 26, color: '#6b7280', margin: 0 }}>{subtitle}</p>
                )}
    
                {price && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '16px', marginTop: '10px',
                  }}>
                    <span style={{
                      background: '#2c4270', color: 'white',
                      padding: '10px 24px', borderRadius: '50px',
                      fontWeight: 800, fontSize: 28,
                    }}>
                      {price}
                    </span>
                    <span style={{ color: '#9ca3af', fontSize: 18 }}>por pack</span>
                  </div>
                )}
              </div>
    
              {/* Product image */}
              {img && (
                <div style={{
                  width: 360, height: 360,
                  borderRadius: '24px',
                  overflow: 'hidden',
                  boxShadow: '0 25px 50px rgba(0,0,0,0.15)',
                  flexShrink: 0,
                }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}
            </div>
    
            {/* Footer */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              borderTop: '1px solid rgba(217,142,30,0.3)', paddingTop: '24px', marginTop: '24px',
            }}>
              <span style={{ color: '#9ca3af', fontSize: 16 }}>Venta por packs · Envíos a todo el país</span>
              <span style={{ color: '#2c4270', fontWeight: 700, fontSize: 18 }}>
                {env.APP_URL.replace('https://', '')}
              </span>
            </div>
          </div>
          ),
      { ...size }
    );
    const buf = await res.arrayBuffer();
    return new Response(buf, {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': cache },
    });
  };

  const CACHE_OK       = 'public, max-age=86400, s-maxage=86400';
  const CACHE_DEGRADED = 'public, max-age=300, s-maxage=300';

  try {
    return await render(image, CACHE_OK);
  } catch (err) {
    console.error('[og] falló al generar la tarjeta con foto:', err instanceof Error ? err.stack ?? err.message : err);
    if (image) {
      try {
        return await render('', CACHE_DEGRADED);
      } catch (err2) {
        console.error('[og] falló también sin foto:', err2 instanceof Error ? err2.stack ?? err2.message : err2);
      }
    }
    return new Response('og: no se pudo generar la imagen', { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}