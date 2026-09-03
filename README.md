# Ecommerce Next.js — Guía completa de producción

Stack: **Next.js 14 · TypeScript · Tailwind CSS · Supabase · Mercado Pago · Resend**

---

## Características principales

- 🛒 Venta por packs (media docena / docena)
- 💳 Pago con Mercado Pago (popup) + Transferencia bancaria
- 🏪 Envío a domicilio y retiro en local
- 👤 Auth con email/contraseña y Google OAuth
- 🔔 Notificaciones en tiempo real para el admin (Supabase Realtime)
- ✅ Aprobación de comprobantes de transferencia con workflow completo
- 📧 Emails transaccionales con Resend
- 🌙 Modo oscuro / claro
- 📱 PWA + Responsive
- 🔒 Rate limiting, validación Zod, seguridad en headers

---

## Requisitos

- Node.js 18+
- Cuenta en [Supabase](https://supabase.com)
- Cuenta en [Mercado Pago Developers](https://www.mercadopago.com.ar/developers)
- Cuenta en [Resend](https://resend.com)

---

## Instalación local

```bash
# 1. Instalar dependencias
npm install

# 2. Copiar variables de entorno
cp .env.local.example .env.local
# Completar todas las variables en .env.local

# 3. Ejecutar migraciones en Supabase
# → Supabase Dashboard → SQL Editor → pegar sql/schema.sql → Run

# 4. Crear primer administrador
# → SQL Editor:
# UPDATE profiles SET rol = 'admin' WHERE email = 'tu@email.com';

# 5. Iniciar
npm run dev
```

---

## Variables de entorno

| Variable | Descripción |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anon de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave service_role (solo servidor) |
| `MERCADOPAGO_ACCESS_TOKEN` | Token de acceso de MP |
| `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` | Clave pública de MP |
| `RESEND_API_KEY` | API key de Resend |
| `RESEND_FROM_EMAIL` | Email remitente verificado en Resend |
| `RESEND_FROM_NAME` | Nombre del remitente |
| `NEXT_PUBLIC_APP_URL` | URL de producción |
| `NEXT_PUBLIC_TIENDA_NOMBRE` | Nombre de la tienda |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Número WhatsApp sin + ni espacios |
| `NEXT_PUBLIC_TAWKTO_PROPERTY_ID` | ID de Tawk.to (opcional) |
| `REVALIDATE_SECRET_TOKEN` | Token para revalidación on-demand |
| `MAINTENANCE_MODE` | `true` o `false` |

---

## Estructura del proyecto

```
src/
├── app/
│   ├── admin/          # Panel de administración
│   ├── api/            # API Routes
│   │   ├── checkout/   # Mercado Pago
│   │   ├── webhooks/   # MP webhook
│   │   └── admin/      # CRUD admin
│   ├── auth/           # Login, registro, OAuth, verificación
│   ├── pago/           # Páginas resultado de pago (exitoso/error/pendiente/cancelado)
│   └── ...             # Páginas públicas
├── components/
├── hooks/              # useCart, useAuth, useWishlist, useRealtimeOrders
├── lib/                # Supabase, email, validaciones, rate limiting
├── types/              # TypeScript types
└── utils/              # Helpers
sql/
└── schema.sql          # Migraciones completas
```

---

## Scripts

```bash
npm run dev           # Desarrollo
npm run build         # Build producción
npm run lint          # Linting
npm run typecheck     # TypeScript check
npm run test          # Tests unitarios (Jest)
npm run test:e2e      # Tests E2E (Playwright)
```

---

## Webhook de Mercado Pago

URL: `https://tudominio.com/api/webhooks/mercadopago`
Eventos: `payment`

---

## Deploy en Vercel

Ver guía completa en la sección de producción del README o consultar la documentación de Vercel.

## Licencia

MIT
