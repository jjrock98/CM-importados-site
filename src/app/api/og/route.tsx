import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

// ✅ 'size' y 'contentType' NO son exports válidos para un route.tsx
// con un handler GET (solo lo son para opengraph-image.tsx / icon.tsx).
// Se usan como constante local pasada directamente a ImageResponse.
const size = { width: 1200, height: 630 };

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const title    = searchParams.get('title')  ?? 'Mi Tienda';
  const subtitle = searchParams.get('subtitle') ?? 'Comprá por packs';
  const price    = searchParams.get('price')  ?? '';
  const image    = searchParams.get('image')  ?? '';

  return new ImageResponse(
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
              width: 'fit-content',
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
          {image && (
            <div style={{
              width: 360, height: 360,
              borderRadius: '24px',
              overflow: 'hidden',
              boxShadow: '0 25px 50px rgba(0,0,0,0.15)',
              flexShrink: 0,
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
            {(process.env.NEXT_PUBLIC_APP_URL ?? '').replace('https://', '')}
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
