/**
 * Funciones de llamada a cada proveedor de IA que puede generar el
 * contenido del producto (nombre/descripción a partir de fotos).
 *
 * Cadena de fallback (definida y orquestada en route.ts): Gemini → Groq →
 * OpenRouter. Los tres proveedores tienen tier gratis, así que cuando uno
 * se queda sin cuota (429) o falla de forma persistente, probamos el
 * siguiente en vez de mostrarle el error crudo al admin.
 *
 * Todos exponen la misma forma de respuesta (ResultadoProveedor) para que
 * route.ts no tenga que conocer los detalles de cada API.
 */

export interface ImagenData {
  mimeType: string;
  data: string; // base64, sin el prefijo data:...;base64,
}

export interface ContenidoGenerado {
  nombre: string;
  descripcion_corta: string;
  descripcion: string;
}

export type ResultadoProveedor =
  | { ok: true; contenido: ContenidoGenerado }
  // reintentable: tiene sentido probar el siguiente proveedor de la cadena
  // (cuota agotada, sobrecarga, error de red, JSON inválido, etc.)
  | { ok: false; motivo: string; status?: number };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Extrae el JSON de la respuesta de texto de un modelo, tolerando que lo
 * envuelva en ```json ... ``` (pasa seguido con modelos que no soportan
 * "modo JSON" forzado, como los que sirve OpenRouter en su tier gratis).
 */
function parsearContenido(rawText: string): ContenidoGenerado | null {
  const limpio = rawText
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '');
  try {
    const parsed = JSON.parse(limpio) as Partial<ContenidoGenerado>;
    if (!parsed.nombre && !parsed.descripcion_corta && !parsed.descripcion) return null;
    return {
      nombre: parsed.nombre?.trim() ?? '',
      descripcion_corta: parsed.descripcion_corta?.trim() ?? '',
      descripcion: parsed.descripcion?.trim() ?? '',
    };
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────────────────────────────────
// Gemini (proveedor principal)
// ────────────────────────────────────────────────────────────────────────

// Se puede pisar con GEMINI_MODEL en Vercel si Google cambia los nombres
// de modelo o si Javier quiere probar uno distinto (ej. gemini-2.5-pro
// para mejores descripciones a costa de cuota más chica). Google renombra
// y da de baja modelos Gemini seguido (varias veces en 2026), así que por
// defecto usamos el alias "gemini-flash-latest": Google lo actualiza
// automáticamente al Flash vigente, en vez de fijar un nombre de modelo
// concreto que puede quedar discontinuado.
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';
// Modelo de respaldo si el principal devuelve 503 (sobrecarga transitoria,
// común en el tier gratis en horarios pico) después de los reintentos.
// OJO: esto es distinto del fallback a OTRO PROVEEDOR (Groq/OpenRouter) —
// este es un segundo modelo dentro de la misma cuenta/cuota de Gemini.
const GEMINI_MODEL_FALLBACK = process.env.GEMINI_MODEL_FALLBACK || 'gemini-2.0-flash';

async function llamarGemini(model: string, apiKey: string, requestBody: object): Promise<Response> {
  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });
}

/**
 * Llama a Gemini con reintentos: el tier gratis devuelve 503 seguido en
 * horarios pico por sobrecarga transitoria del modelo, no por un error
 * real de la request. Reintenta 2 veces con backoff corto sobre el mismo
 * modelo y, si sigue devolviendo 503, prueba una vez con GEMINI_MODEL_FALLBACK
 * antes de rendirse. Un 429 (cuota agotada) no se reintenta acá — no tiene
 * sentido, la cuota es por proyecto/key, no por modelo — se corta al toque
 * para que route.ts pase al siguiente proveedor de la cadena.
 */
async function llamarGeminiConReintentos(apiKey: string, requestBody: object): Promise<Response> {
  let ultimaRes: Response | null = null;
  for (const intento of [0, 1, 2]) {
    if (intento > 0) await sleep(intento * 1200);
    ultimaRes = await llamarGemini(GEMINI_MODEL, apiKey, requestBody);
    if (ultimaRes.ok || ultimaRes.status !== 503) return ultimaRes;
  }
  if (GEMINI_MODEL_FALLBACK && GEMINI_MODEL_FALLBACK !== GEMINI_MODEL) {
    const resFallback = await llamarGemini(GEMINI_MODEL_FALLBACK, apiKey, requestBody);
    if (resFallback.ok) return resFallback;
  }
  return ultimaRes!;
}

export async function generarConGemini(
  apiKey: string,
  prompt: string,
  imagenes: ImagenData[]
): Promise<ResultadoProveedor> {
  try {
    const res = await llamarGeminiConReintentos(apiKey, {
      contents: [
        {
          parts: [
            { text: prompt },
            ...imagenes.map((img) => ({ inline_data: { mime_type: img.mimeType, data: img.data } })),
          ],
        },
      ],
      generationConfig: { responseMimeType: 'application/json' },
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('[generar-ia] Gemini error:', res.status, errText);
      let detalle = errText.slice(0, 200);
      try {
        const parsedErr = JSON.parse(errText);
        detalle = parsedErr?.error?.message?.slice(0, 200) || detalle;
      } catch { /* errText no era JSON, se usa el texto crudo */ }
      return { ok: false, status: res.status, motivo: `Gemini (${res.status}): ${detalle || 'sin detalle'}` };
    }

    const json = await res.json();
    const rawText: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return { ok: false, motivo: 'Gemini no devolvió contenido' };

    const contenido = parsearContenido(rawText);
    if (!contenido) return { ok: false, motivo: 'Gemini devolvió una respuesta vacía o inválida' };
    return { ok: true, contenido };
  } catch (err) {
    console.error('[generar-ia] Excepción llamando a Gemini:', err);
    return { ok: false, motivo: 'Error de red llamando a Gemini' };
  }
}

// ────────────────────────────────────────────────────────────────────────
// Groq (2do en la cadena: Llama 4 Scout, con visión, tier gratis rápido)
// ────────────────────────────────────────────────────────────────────────

const GROQ_MODEL = process.env.GROQ_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';

export async function generarConGroq(
  apiKey: string,
  prompt: string,
  imagenes: ImagenData[]
): Promise<ResultadoProveedor> {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              ...imagenes.map((img) => ({
                type: 'image_url',
                image_url: { url: `data:${img.mimeType};base64,${img.data}` },
              })),
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('[generar-ia] Groq error:', res.status, errText);
      let detalle = errText.slice(0, 200);
      try {
        const parsedErr = JSON.parse(errText);
        detalle = parsedErr?.error?.message?.slice(0, 200) || detalle;
      } catch { /* errText no era JSON */ }
      return { ok: false, status: res.status, motivo: `Groq (${res.status}): ${detalle || 'sin detalle'}` };
    }

    const json = await res.json();
    const rawText: string | undefined = json?.choices?.[0]?.message?.content;
    if (!rawText) return { ok: false, motivo: 'Groq no devolvió contenido' };

    const contenido = parsearContenido(rawText);
    if (!contenido) return { ok: false, motivo: 'Groq devolvió una respuesta vacía o inválida' };
    return { ok: true, contenido };
  } catch (err) {
    console.error('[generar-ia] Excepción llamando a Groq:', err);
    return { ok: false, motivo: 'Error de red llamando a Groq' };
  }
}

// ────────────────────────────────────────────────────────────────────────
// OpenRouter (3ro en la cadena: router de modelos gratis con visión)
// ────────────────────────────────────────────────────────────────────────

// "openrouter/free" elige automáticamente, entre los modelos gratis
// disponibles en OpenRouter, uno que soporte imágenes — no hace falta
// mantener nosotros una lista de modelos que rotan seguido en su tier
// gratis. Se puede pisar con OPENROUTER_MODEL si se prefiere fijar uno.
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'openrouter/free';

export async function generarConOpenRouter(
  apiKey: string,
  prompt: string,
  imagenes: ImagenData[]
): Promise<ResultadoProveedor> {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        // Recomendados por OpenRouter para identificar la app en sus stats;
        // no son obligatorios para que funcione la request.
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://www.mc-importados.shop',
        'X-Title': 'MC Importados - Admin',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              ...imagenes.map((img) => ({
                type: 'image_url',
                image_url: { url: `data:${img.mimeType};base64,${img.data}` },
              })),
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('[generar-ia] OpenRouter error:', res.status, errText);
      let detalle = errText.slice(0, 200);
      try {
        const parsedErr = JSON.parse(errText);
        detalle = parsedErr?.error?.message?.slice(0, 200) || detalle;
      } catch { /* errText no era JSON */ }
      return { ok: false, status: res.status, motivo: `OpenRouter (${res.status}): ${detalle || 'sin detalle'}` };
    }

    const json = await res.json();
    const rawText: string | undefined = json?.choices?.[0]?.message?.content;
    if (!rawText) return { ok: false, motivo: 'OpenRouter no devolvió contenido' };

    const contenido = parsearContenido(rawText);
    if (!contenido) return { ok: false, motivo: 'OpenRouter devolvió una respuesta vacía o inválida' };
    return { ok: true, contenido };
  } catch (err) {
    console.error('[generar-ia] Excepción llamando a OpenRouter:', err);
    return { ok: false, motivo: 'Error de red llamando a OpenRouter' };
  }
}