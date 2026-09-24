# MC Importados — Tienda online

Tienda online de indumentaria y calzado al por mayor (packs por docena y media docena), con venta minorista para productos puntuales y panel de administración propio. Está online en [mc-importados.shop](https://www.mc-importados.shop).

**Stack:** Next.js 16 (App Router + Turbopack) · React 19 · TypeScript · Tailwind CSS · Supabase · Mercado Pago · Resend · Vercel

---

## Qué hace

**Tienda**
- Venta mayorista por packs (docena / media docena), con precios escalonados por volumen y curva de talles por pack.
- Venta minorista en `/minorista` para los productos que la tengan habilitada, con mínimo de unidades por producto(Deshabilitado)
- Variantes por talle y color, con stock propio por variante(Deshabilitado)
- Carrito con reserva de stock, wishlist, pedido rápido (`/pedido-rapido`) y "repetir pedido".
- Compra como invitado o con cuenta (email/contraseña, Google).
- Envío a domicilio, retiro en el local y entrega en micros, con zonas de envío configurables.
- Seguimiento de pedidos por número (`/seguimiento`) y historial en `/mis-pedidos`.
- Buscador, filtros por categoría, reseñas, productos relacionados y aviso de reposición de stock.
- Modo oscuro / claro, PWA y diseño responsive.

**Pagos**
- Mercado Pago (con webhook firmado), transferencia bancaria con carga de comprobante, efectivo al retirar y cuenta corriente para clientes mayoristas.
- Stripe no se usa (no está disponible en Argentina): la ruta `/api/checkout/stripe` quedó solo como stub que devuelve 404.

**Panel de administración (`/admin`)**
- Pedidos: aprobar / rechazar comprobantes, marcar como pagado, verificar retiro en el local, exportar a Excel.
- Productos y variantes, con generación de nombre y descripción a partir de fotos usando IA (cadena de fallback Gemini → Groq → OpenRouter).
- Lista de precios mayorista en PDF.
- Clientes mayoristas y cuenta corriente (movimientos, registro de pagos, condiciones).
- Costos y rentabilidad, con exportación a CSV, Excel y PDF.
- Mensajes de contacto, reseñas, configuración del sitio y modo mantenimiento.
- Notificaciones en tiempo real (Supabase Realtime), push web y Telegram.
- 2FA (TOTP) opcional para admins.

**Integraciones**
- Catálogo de Meta / WhatsApp Business: los productos de Supabase se sincronizan con Commerce Manager mediante un Database Webhook (ver más abajo).
- Meta Pixel y verificación de dominio de Facebook.
- Tawk.to (chat, opcional) y botón flotante de WhatsApp.

**Seguridad**
- Validación con Zod en formularios y APIs, y validación de variables de entorno al arrancar (`src/env.ts`).
- Rate limiting global en el proxy más límites específicos por ruta.
- Verificación de `Origin` en requests que modifican datos (CSRF).
- Bloqueo geográfico en las rutas de pedidos y checkout (solo Argentina).
- Cloudflare Turnstile en login, registro y contacto.
- Escaneo antivirus de comprobantes subidos (Cloudmersive, opcional).
- Cierre de sesión por inactividad: 2 h para clientes y 30 min para admin.
- Comparación de secretos en tiempo constante en webhooks y crons.
- Headers de seguridad y CSP en `next.config.js` y `vercel.json`.

---

## Requisitos

- Node.js 18.17 o superior (en CI se usa Node 20)
- Proyecto en [Supabase](https://supabase.com)
- Cuenta en [Mercado Pago Developers](https://www.mercadopago.com.ar/developers)
- Cuenta en [Resend](https://resend.com)

---

## Instalación local

```bash
# 1. Instalar dependencias
npm install

# 2. Crear el archivo de variables de entorno
#    (usar la tabla de más abajo como referencia)
touch .env.local

# 3. Crear las tablas y funciones en Supabase
#    Dashboard → SQL Editor → pegar sql/schema.sql → Run

# 4. Crear el primer admin (SQL Editor):
#    UPDATE profiles SET rol = 'admin' WHERE email = 'tu@email.com';

# 5. Levantar el proyecto
npm run dev
```

---

## Variables de entorno

Las obligatorias se validan al arrancar (`src/env.ts`). Si falta alguna, se loguea el error pero no se corta el build: cada función falla de forma aislada hasta que se configure.

### Obligatorias

| Variable | Descripción |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anon de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave service_role (solo servidor) |
| `MERCADOPAGO_ACCESS_TOKEN` | Access token de Mercado Pago |
| `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` | Clave pública de Mercado Pago |
| `RESEND_API_KEY` | API key de Resend (empieza con `re_`) |
| `RESEND_FROM_EMAIL` | Email remitente verificado en Resend |
| `NEXT_PUBLIC_APP_URL` | URL de producción, sin barra final |

### Opcionales

| Variable | Descripción |
|---|---|
| `RESEND_FROM_NAME` | Nombre del remitente |
| `ADMIN_EMAIL` | Email donde llegan los avisos al admin (si no, usa `RESEND_FROM_EMAIL`) |
| `NEXT_PUBLIC_TIENDA_NOMBRE` | Nombre de la tienda |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Número de WhatsApp, sin `+` ni espacios |
| `NEXT_PUBLIC_WHATSAPP_MESSAGE` | Mensaje predeterminado del botón de WhatsApp |
| `NEXT_PUBLIC_WHATSAPP_GROUP_LINK` | Link al grupo de WhatsApp |
| `NEXT_PUBLIC_TAWKTO_PROPERTY_ID` / `NEXT_PUBLIC_TAWKTO_WIDGET_ID` | Chat de Tawk.to |
| `MAINTENANCE_MODE` | `true` para activar el modo mantenimiento sin redeploy |
| `REVALIDATE_SECRET_TOKEN` | Secret para `/api/revalidate` y los endpoints de `/api/cron/*` |
| `CRON_SECRET` | Secret que Vercel manda en el cron nativo de `/api/revalidate` |
| `MERCADOPAGO_WEBHOOK_SECRET` | Secret para validar la firma del webhook de Mercado Pago |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile |
| `CLOUDMERSIVE_API_KEY` | Escaneo de virus en comprobantes (si falta, se omite) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_EMAIL` | Notificaciones push web |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | Avisos al admin por Telegram |
| `GEMINI_API_KEY` / `GEMINI_MODEL` / `GEMINI_MODEL_FALLBACK` | Generación de contenido con IA (proveedor 1) |
| `GROQ_API_KEY` / `GROQ_MODEL` | Generación con IA (fallback 2) |
| `OPENROUTER_API_KEY` / `OPENROUTER_MODEL` | Generación con IA (fallback 3) |
| `NEXT_PUBLIC_FB_PIXEL_ID` | Meta Pixel |
| `NEXT_PUBLIC_FB_APP_ID` / `FACEBOOK_APP_SECRET` | Login con Facebook y webhook de deauthorize |
| `NEXT_PUBLIC_FB_DOMAIN_VERIFICATION` | Verificación de dominio en Meta |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | Verificación en Google Search Console |
| `META_ACCESS_TOKEN` | Token de System User de Meta (sync de catálogo) |
| `META_CATALOG_ID` | ID del catálogo en Commerce Manager |
| `SUPABASE_META_WEBHOOK_SECRET` | Secret del webhook Supabase → Meta |
| `META_GRAPH_API_VERSION` | Versión de la Graph API (por defecto `v23.0`) |

---

## Estructura del proyecto

```
src/
├── app/
│   ├── admin/            # Panel de administración
│   ├── api/
│   │   ├── admin/        # CRUD y acciones del panel
│   │   ├── auth/         # Login, registro, reset de contraseña
│   │   ├── checkout/     # Mercado Pago
│   │   ├── cron/         # cleanup-reservations, stock-alerts
│   │   ├── mi-cuenta/    # Cuenta corriente del cliente
│   │   ├── orders/       # Creación, cancelación y export de pedidos
│   │   └── webhooks/     # mercadopago, supabase-to-meta, facebook-deauthorize
│   ├── auth/             # Login, registro, MFA, verificación, callback OAuth
│   ├── pago/             # Resultado de pago (exitoso / error / pendiente / cancelado)
│   ├── productos/        # Catálogo y ficha de producto
│   └── ...               # Resto de páginas públicas
├── components/           # admin, cart, common, home, layout, products, etc.
├── hooks/                # useCart, useAuth, useWishlist, useRealtimeOrders, ...
├── lib/                  # Supabase, emails, rate limit, validaciones, push, Telegram
│   └── supabase/         # Clientes: server, client, admin, public (sin cookies)
├── proxy.ts              # Auth, rutas protegidas, mantenimiento, CSRF, geo, rate limit
├── env.ts                # Validación de variables de entorno
├── types/
└── utils/
sql/
└── schema.sql            # Tablas, funciones, triggers y políticas RLS
e2e/                      # Tests de Playwright
```

---

## Scripts

```bash
npm run dev           # Desarrollo
npm run build         # Build de producción
npm run start         # Servir el build
npm run lint          # ESLint
npm run typecheck     # Chequeo de tipos
npm test              # Tests unitarios (Jest)
npm run test:coverage # Tests con cobertura
npm run test:e2e      # Tests E2E (Playwright)
```

El pipeline de GitHub Actions (`.github/workflows/ci.yml`) corre typecheck, lint, tests, build y, en los PR a `main`, los tests E2E.

---

## Notas sobre Next.js 16

- `src/middleware.ts` pasó a llamarse `src/proxy.ts` y exporta `proxy` (convención de Next 16).
- La ruta `/api/og` corre en runtime `nodejs` en lugar de `edge`.
- Para no perder el render estático/ISR, el footer del layout raíz usa `src/lib/supabase/public.ts` (cliente sin cookies) en vez del cliente con sesión. Si se usa `cookies()` en el layout, todo el sitio pasa a renderizarse dinámico.
- La redirección de los query params legacy de la home (`?q=`, `?categoria=`, `?pagina=`) se hace en el proxy y no leyendo `searchParams` en `page.tsx`, para que la home siga cacheada (ISR de 60 s).

---

## Webhooks

### Mercado Pago

- URL: `https://tudominio.com/api/webhooks/mercadopago`
- Evento: `payment`
- La firma se valida con `MERCADOPAGO_WEBHOOK_SECRET`.

### Supabase → Meta (catálogo)

Mantiene sincronizada la tabla `products` con el catálogo de Meta Commerce Manager.

- Endpoint: `POST /api/webhooks/supabase-to-meta?secret=<SUPABASE_META_WEBHOOK_SECRET>`
- Archivo: `src/app/api/webhooks/supabase-to-meta/route.ts`
- `INSERT` → `CREATE`, `UPDATE` → `UPDATE`, `DELETE` → `DELETE`, enviados a `/{catalog_id}/items_batch` de la Graph API.

Configuración:

1. En Supabase, habilitar webhooks (**Database → Webhooks → Enable webhooks**). Si aparece el error `schema "supabase_functions" does not exist`, es porque falta este paso.
2. Crear un Database Webhook sobre la tabla `products` (INSERT, UPDATE y DELETE) que apunte a la URL de arriba, con el secret como query param.
3. Cargar `META_ACCESS_TOKEN`, `META_CATALOG_ID` y `SUPABASE_META_WEBHOOK_SECRET` en Vercel.

El `META_ACCESS_TOKEN` tiene que ser un token de **System User** de Business Manager (no vence). Un token de usuario común caduca y el webhook empieza a devolver 502. El System User necesita acceso al catálogo y la app con la que se genera el token tiene que pertenecer al mismo business que el catálogo o estar compartida con él.

Pendiente de verificar: el precio se envía como entero en centavos (`precio_docena × 100`). Confirmar en Commerce Manager con un producto de prueba que se vea bien; si no, hay que pasar a decimal (`"75000.00"`) con `currency` aparte.

---

## Cron jobs

Vercel Hobby solo permite 2 crons nativos con frecuencia máxima diaria, así que en `vercel.json` queda únicamente `/api/revalidate` (una vez por día). Los otros dos se disparan desde un servicio externo (cron-job.org):

| Endpoint | Frecuencia | Para qué |
|---|---|---|
| `/api/cron/cleanup-reservations` | cada hora | Libera el stock reservado de pedidos por transferencia que no se pagaron |
| `/api/cron/stock-alerts` | cada 10 min | Push al admin cuando se agota un talle/color |

Ambos reciben `?secret=<REVALIDATE_SECRET_TOKEN>`. El paso a paso está en [CRON_SETUP.md](./CRON_SETUP.md).

---

## Deploy en Vercel

1. Importar el repositorio en Vercel.
2. Cargar las variables de entorno (Project Settings → Environment Variables).
3. La región está fijada en `gru1` (São Paulo) en `vercel.json`.
4. Configurar los webhooks (Mercado Pago y Supabase → Meta) apuntando al dominio de producción.
5. Dar de alta los crons externos según `CRON_SETUP.md`.

## Licencia
