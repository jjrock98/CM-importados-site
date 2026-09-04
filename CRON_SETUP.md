# Configuración de Cron Jobs — Plan Vercel Hobby

Vercel Hobby limita los **Cron Jobs nativos** (los definidos en `vercel.json`)
a un máximo de **2 jobs**, cada uno ejecutándose **como mucho 1 vez por día**.
Este proyecto necesita dos tareas que corren con mucha más frecuencia:

| Endpoint | Frecuencia necesaria | Por qué |
|---|---|---|
| `/api/cron/cleanup-reservations` | cada hora | Libera stock reservado de pedidos por transferencia que no se pagaron a tiempo |
| `/api/cron/stock-alerts` | cada 10 min | Avisa al admin por push cuando un talle/color específico se agota |

Como el límite de Hobby es sobre la **feature nativa de Cron Jobs de Vercel**,
no sobre quién le pega a tus URLs por HTTPS, la solución es usar un servicio
externo gratuito que dispare esas peticiones con la frecuencia real que
necesitás. El único cron que quedó en `vercel.json` (`/api/revalidate`,
1 vez por día) sí cumple el límite de Hobby y no necesita nada más.

## Paso a paso con cron-job.org (gratis, sin tarjeta)

1. Creá una cuenta en **https://cron-job.org** (gratis, permite hasta 50 cron jobs con intervalos de 1 minuto).

2. **Job 1 — Limpieza de reservas de stock**
   - URL: `https://www.mc-importados.shop/api/cron/cleanup-reservations?secret=TU_REVALIDATE_SECRET_TOKEN`
   - Schedule: cada hora (`Every hour`, minuto 0)
   - Método: GET
   - Guardalo y activalo.

3. **Job 2 — Alertas de quiebre de stock**
   - URL: `https://www.mc-importados.shop/api/cron/stock-alerts?secret=TU_REVALIDATE_SECRET_TOKEN`
   - Schedule: cada 10 minutos
   - Método: GET
   - Guardalo y activalo.

4. Reemplazá `TU_REVALIDATE_SECRET_TOKEN` por el valor real de la variable
   de entorno `REVALIDATE_SECRET_TOKEN` que configuraste en Vercel
   (Project Settings → Environment Variables). Es el mismo secret que ya
   usa `/api/revalidate`.

5. cron-job.org tiene un historial de ejecuciones — revisalo de vez en
   cuando para confirmar que las peticiones devuelven 200 OK. Si alguna
   vez ves 401, es que el secret no coincide; si ves 500, revisá los logs
   de la función en Vercel.

## Alternativas si preferís no depender de un servicio externo

- **GitHub Actions**: si tu código está en GitHub, podés usar un workflow
  con `schedule: cron` que haga un `curl` a esas URLs. Es gratis para
  repos públicos y tiene una cuota generosa para privados también.
- **Subir a Vercel Pro** ($20/mes): ahí los Cron Jobs nativos no tienen
  límite de frecuencia ni de cantidad — simplemente volverías a poner
  estos dos jobs en `vercel.json` como estaban originalmente (podés ver
  el historial de este archivo o pedírselo a Claude en una próxima
  sesión).

## Importante

Sin uno de estos dos crons corriendo:
- **`cleanup-reservations` inactivo** → el stock de pedidos por transferencia
  que nunca se pagaron queda "trabado" indefinidamente (nunca se libera
  automáticamente). Vas a tener que liberarlo a mano desde el admin.
- **`stock-alerts` inactivo** → simplemente no vas a recibir el push de
  "se agotó tal talle/color", pero el stock en sí sigue funcionando bien
  igual (no afecta ventas, solo el aviso).

Ninguno de los dos es crítico para que la tienda funcione — son
automatizaciones de conveniencia. Podés arrancar sin configurarlos y
sumarlos cuando quieras.
