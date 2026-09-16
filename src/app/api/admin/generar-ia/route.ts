import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { categoriaLabel } from '@/lib/categorias';

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single();
  return profile?.rol === 'admin' ? user : null;
}

// Máximo de imágenes que se mandan al modelo por request. Más fotos = más
// tokens consumidos contra la cuota gratis de Gemini sin aportar demasiada
// info extra (con la principal + 2-3 ángulos alcanza para describir el
// producto). El orden que llega ya trae la principal primero (drag&drop
// del admin), así que tomamos las primeras `MAX_IMAGENES`.
const MAX_IMAGENES = 4;

// Se puede pisar con GEMINI_MODEL en Vercel si Google cambia los nombres
// de modelo o si Javier quiere probar uno distinto (ej. gemini-2.5-pro
// para mejores descripciones a costa de cuota más chica). Google renombra
// y da de baja modelos Gemini seguido (varias veces en 2026), así que por
// defecto usamos el alias "gemini-flash-latest": Google lo actualiza
// automáticamente al Flash vigente, en vez de fijar un nombre de modelo
// concreto que puede quedar discontinuado.
const MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';

interface GenerarIABody {
  imagenes?: string[];
  categoria?: string;
  colores?: string[];
  talles?: string[];
  ventaMinorista?: boolean;
  ventaMayorista?: boolean;
}

async function imagenABase64(url: string): Promise<{ mimeType: string; data: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await res.arrayBuffer());
    return { mimeType: contentType, data: buffer.toString('base64') };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Falta configurar GEMINI_API_KEY en las variables de entorno del servidor' },
      { status: 500 }
    );
  }

  const body = (await req.json().catch(() => null)) as GenerarIABody | null;
  const imagenes = (body?.imagenes ?? []).slice(0, MAX_IMAGENES);
  if (imagenes.length === 0) {
    return NextResponse.json({ error: 'Subí al menos una imagen antes de generar con IA' }, { status: 422 });
  }

  // Descarga las imágenes en paralelo y las pasa a base64: la API de Gemini
  // no acepta URLs públicas directamente en generateContent, necesita los
  // bytes inline.
  const imagenesData = (await Promise.all(imagenes.map(imagenABase64))).filter(
    (i): i is { mimeType: string; data: string } => i !== null
  );
  if (imagenesData.length === 0) {
    return NextResponse.json({ error: 'No se pudo descargar ninguna de las imágenes del producto' }, { status: 500 });
  }

  const contexto: string[] = [];
  contexto.push(`Categoría: ${categoriaLabel(body?.categoria ?? 'otro')}`);
  if (body?.colores?.length) contexto.push(`Colores cargados: ${body.colores.join(', ')}`);
  if (body?.talles?.length) contexto.push(`Talles cargados: ${body.talles.join(', ')}`);
  contexto.push(
    body?.ventaMinorista
      ? 'Se vende al público por unidad (minorista).'
      : 'Se vende por docena/media docena a comercios (mayorista).'
  );

  const prompt = `Sos redactor de e-commerce para una tienda argentina de indumentaria y calzado importado (venta mayorista y minorista). Mirá las fotos adjuntas del producto y generá el contenido para publicarlo en el catálogo.

Contexto ya cargado (no lo repitas literal, usalo de guía):
${contexto.join('\n')}

Respondé ÚNICAMENTE un JSON válido, sin texto adicional, sin markdown ni backticks, con esta forma exacta:
{"nombre": "...", "descripcion_corta": "...", "descripcion": "..."}

Reglas:
- "nombre": corto y descriptivo, máximo 60 caracteres, sin inventar una marca que no se vea en la foto.
- "descripcion_corta": una frase breve (máximo 100 caracteres), tipo bajada de catálogo.
- "descripcion": 2 a 4 oraciones completas, mencionando material/estilo/uso que se vea realmente en la imagen. No inventes colores, talles ni materiales que no se puedan confirmar por la foto o por el contexto dado.
- Todo en español rioplatense, tono comercial pero natural (no genérico de IA).`;

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                ...imagenesData.map((img) => ({ inline_data: { mime_type: img.mimeType, data: img.data } })),
              ],
            },
          ],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text().catch(() => '');
      console.error('Gemini API error:', geminiRes.status, errText);
      // Devolvemos el motivo real (acortado) para poder diagnosticar desde
      // el toast del admin sin tener que ir a mirar los logs de Vercel.
      let detalle = errText.slice(0, 200);
      try {
        const parsedErr = JSON.parse(errText);
        detalle = parsedErr?.error?.message?.slice(0, 200) || detalle;
      } catch { /* errText no era JSON, se usa el texto crudo */ }
      return NextResponse.json(
        { error: `Gemini devolvió un error (${geminiRes.status}): ${detalle || 'sin detalle'}` },
        { status: 502 }
      );
    }

    const geminiJson = await geminiRes.json();
    const rawText: string | undefined = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      return NextResponse.json({ error: 'La IA no devolvió contenido' }, { status: 502 });
    }

    // Por las dudas: si el modelo igual envuelve la respuesta en ```json ... ```
    const limpio = rawText.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '');
    const parsed = JSON.parse(limpio) as { nombre?: string; descripcion_corta?: string; descripcion?: string };

    if (!parsed.nombre && !parsed.descripcion_corta && !parsed.descripcion) {
      return NextResponse.json({ error: 'La IA devolvió una respuesta vacía o inválida' }, { status: 502 });
    }

    return NextResponse.json({
      nombre: parsed.nombre?.trim() ?? '',
      descripcion_corta: parsed.descripcion_corta?.trim() ?? '',
      descripcion: parsed.descripcion?.trim() ?? '',
    });
  } catch (err) {
    console.error('Error generando con IA:', err);
    return NextResponse.json({ error: 'Error inesperado generando el contenido con IA' }, { status: 500 });
  }
}