# Configuración de tareas programadas (Vercel Schedules y cron-job.org)

El sitio tiene **5 tareas programadas**. Tres las dispara Vercel con **Schedules**
(definidas en `vercel.json`, clave `schedules`) y dos las dispara un servicio externo
gratuito (cron-job.org), porque necesitan correr cada 10 minutos y el plan Hobby de
Vercel permite como máximo una ejecución cada 15 minutos.

| Tarea | Quién la dispara | Frecuencia | Para qué |
|---|---|---|---|
| `/api/revalidate` | Vercel (Schedules) | todos los días 03:00 UTC | Revalida el catálogo |
| `/api/cron/cleanup-visitor-logs` | Vercel (Schedules) | todos los días 03:30 UTC | Limpia registros de visitas viejos |
| `/api/cron/sync-merchant` | Vercel (Schedules) | todos los días 06:00 UTC | Sincroniza con Google Merchant Center |
| `/api/cron/cleanup-reservations` | cron-job.org | cada hora | Libera el stock de pedidos por transferencia que no se pagaron |
| `/api/cron/stock-alerts` | cron-job.org | cada 10 minutos | Push al admin cuando se agota un talle/color |

---

## 1. Schedules de Vercel → variable `CRON_SECRET`

Los tres están en `vercel.json`, con `"requestMethod": "GET"` (Schedules usa POST por
defecto y las rutas del sitio son GET). **No dejes `crons` y `schedules` a la vez**: cada
ruta correría dos veces (hay un test que lo controla).

Vercel manda `Authorization: Bearer <CRON_SECRET>` en cada ejecución, **pero solo
si la variable `CRON_SECRET` existe en el proyecto**. La tenés que crear vos:
Vercel no la genera sola.

1. Generá un valor aleatorio (PowerShell):
   ```powershell
   $b = New-Object byte[] 32; [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); ($b | ForEach-Object { $_.ToString('x2') }) -join ''
   ```
   Da 64 caracteres (letras y números), sin símbolos que compliquen una URL.
2. En Vercel: Project → Settings → Environment Variables → agregar
   `CRON_SECRET` con ese valor (Production) y **Sensitive** activado.
3. Hacer un **Redeploy**.

**Cómo comprobar que funcionan** (en el dashboard de Vercel → **Schedules**):
- Tienen que aparecer los tres: `revalidate`, `cleanup-visitor-logs` y `sync-merchant`.
- Elegí uno y tocá **Run Schedule**: la ejecución queda en el historial con su resultado.
  Tiene que dar éxito (HTTP 200).
- También podés ver el historial de las ejecuciones programadas y pausar un schedule
  (**Disable**) sin redeployar.

Sin `CRON_SECRET`, los tres responden **401** y no hacen nada (el catálogo no se
revalida, no se limpian visitas y no se sincroniza Merchant Center).

**Volver atrás:** restaurar el bloque `crons` anterior de `vercel.json` (y sacar
`schedules`) y hacer deploy a producción.

---

## 2. Crons externos con cron-job.org → variable `REVALIDATE_SECRET_TOKEN`

1. Cuenta gratuita en https://cron-job.org (sin tarjeta).
2. **Job 1 — Limpieza de reservas de stock**
   - URL: `https://www.mc-importados.shop/api/cron/cleanup-reservations?secret=TU_REVALIDATE_SECRET_TOKEN`
   - Schedule: cada hora (minuto 0) · Método: GET
3. **Job 2 — Alertas de quiebre de stock**
   - URL: `https://www.mc-importados.shop/api/cron/stock-alerts?secret=TU_REVALIDATE_SECRET_TOKEN`
   - Schedule: cada 10 minutos · Método: GET
4. Reemplazá `TU_REVALIDATE_SECRET_TOKEN` por el valor real de la variable
   `REVALIDATE_SECRET_TOKEN` de Vercel.
5. Revisá el historial de vez en cuando: tiene que dar **200 OK**.
   - **401** → el secreto de la URL no coincide con el de Vercel.
   - **500** → mirar los logs de la función en Vercel (o el panel de Sentry).

> Estas dos rutas solo aceptan el secreto en la URL (`?secret=`), por eso el
> secreto queda visible en la pantalla de cron-job.org. **No compartas capturas
> de esa pantalla.**

---

## 3. Cambiar (rotar) un secreto

Hacelo si se mostró en una captura, un chat o un repositorio.

**`REVALIDATE_SECRET_TOKEN`:**
1. Generar un valor nuevo (comando de arriba).
2. En Vercel, reemplazar el valor de `REVALIDATE_SECRET_TOKEN` y hacer **Redeploy**.
3. Apenas termine el deploy, editar los **dos** jobs de cron-job.org y reemplazar
   el valor después de `secret=`.
4. Si usás `.env.local` para desarrollar, actualizarlo también.

Entre el paso 2 y el 3 los jobs dan 401 unos minutos: no pasa nada, la próxima
ejecución ya sale bien.

**`CRON_SECRET`:** generar uno nuevo, reemplazarlo en Vercel y redeployar. No hay
nada más que actualizar, porque Vercel lo manda solo.

---

## Qué pasa si un cron no corre

- **`cleanup-reservations` inactivo** → el stock de pedidos por transferencia que
  nunca se pagaron queda "trabado" (no se libera solo). Habría que liberarlo a mano
  desde el admin.
- **`stock-alerts` inactivo** → no llega el push de "se agotó tal talle/color". Las
  ventas funcionan igual.
- **Schedules de Vercel inactivos** (falta `CRON_SECRET`) → catálogo sin revalidar por la
  noche, visitas sin limpiar y Merchant Center sin sincronizar.