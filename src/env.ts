import { z } from 'zod';

// ✅ Sin Stripe — el proyecto usa Mercado Pago + Transferencia bancaria.
const serverSchema = z.object({
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL:      z.string().url('NEXT_PUBLIC_SUPABASE_URL debe ser una URL válida'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY es requerida'),
  SUPABASE_SERVICE_ROLE_KEY:     z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY es requerida'),

  // Mercado Pago
  MERCADOPAGO_ACCESS_TOKEN:           z.string().min(1, 'MERCADOPAGO_ACCESS_TOKEN es requerida'),
  NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY: z.string().min(1, 'NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY es requerida'),

  // Email
  RESEND_API_KEY:    z.string().startsWith('re_', 'RESEND_API_KEY debe empezar con re_'),
  RESEND_FROM_EMAIL: z.string().email('RESEND_FROM_EMAIL debe ser un email válido'),
  RESEND_FROM_NAME:  z.string().optional(),

  // App
  NEXT_PUBLIC_APP_URL:         z.string().url('NEXT_PUBLIC_APP_URL debe ser una URL válida'),
  NEXT_PUBLIC_TIENDA_NOMBRE:   z.string().optional(),
  NEXT_PUBLIC_WHATSAPP_NUMBER: z.string().optional(),
  REVALIDATE_SECRET_TOKEN:     z.string().optional(),
  MAINTENANCE_MODE:            z.string().optional(),
  NODE_ENV:                    z.enum(['development', 'test', 'production']).default('development'),
});

function validateEnv() {
  // Solo validar en servidor, nunca en el navegador ni en tests
  if (typeof window !== 'undefined') return;
  if (process.env.NODE_ENV === 'test') return;

  const result = serverSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues.map(
      (issue) => `  ✗ ${issue.path.join('.')}: ${issue.message}`
    );
    console.error('\n❌ Variables de entorno inválidas:\n' + errors.join('\n') + '\n');

    // ✅ NUNCA lanzar excepción durante el build/runtime de producción.
    // Un throw acá tumbaría el build entero o el server completo en
    // Vercel si falta o está mal alguna variable. Preferimos loguear
    // el error claramente y dejar que cada feature falle de forma
    // controlada (ej: el botón de pago muestra error) en vez de
    // voltear toda la aplicación.
    if (process.env.NODE_ENV === 'production') {
      console.error('⚠️  La app continuará, pero las funciones que dependen de estas variables fallarán hasta que se configuren correctamente en Vercel → Settings → Environment Variables.');
    }
  }
}

// Validar una vez al cargar el módulo (solo loguea, nunca rompe el build)
validateEnv();

export const env = {
  // Server-only
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  MERCADOPAGO_ACCESS_TOKEN:  process.env.MERCADOPAGO_ACCESS_TOKEN ?? '',
  RESEND_API_KEY:            process.env.RESEND_API_KEY ?? '',
  RESEND_FROM_EMAIL:         process.env.RESEND_FROM_EMAIL ?? '',
  RESEND_FROM_NAME:          process.env.RESEND_FROM_NAME ?? 'Mi Tienda',
  REVALIDATE_SECRET_TOKEN:   process.env.REVALIDATE_SECRET_TOKEN ?? '',
  MAINTENANCE_MODE:          process.env.MAINTENANCE_MODE === 'true',

  // Public (seguro exponer al cliente)
  APP_URL:         process.env.NEXT_PUBLIC_APP_URL ?? '',
  SUPABASE_URL:    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  MP_PUBLIC_KEY:   process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY ?? '',
  TIENDA_NOMBRE:   process.env.NEXT_PUBLIC_TIENDA_NOMBRE ?? 'Mi Tienda',
  WHATSAPP_NUMBER: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER,
  TAWKTO_ID:       process.env.NEXT_PUBLIC_TAWKTO_PROPERTY_ID,
} as const;
