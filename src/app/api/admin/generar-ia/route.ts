import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { categoriaLabel } from '@/lib/categorias';
import {
  generarConGemini,
  generarConGroq,
  generarConOpenRouter,
  type ImagenData,
  type ResultadoProveedor,
} from './proveedores';

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single();
  return profile?.rol === 'admin' ? user : null;
}

// Máximo de imágenes que se mandan al modelo por request. Más fotos = más
// tokens consumidos contra la cuota gratis sin aportar demasiada info
// extra (con la principal + 2-3 ángulos alcanza para describir el
// producto). El orden que llega ya trae la principal primero (drag&drop
// del admin), así que tomamos las primeras `MAX_IMAGENES`.
const MAX_IMAGENES = 4;

interface GenerarIABody {
  imagenes?: string[];
  categoria?: string;
  colores?: string[];
  talles?: string[];
  ventaMinorista?: boolean;
  ventaMayorista?: boolean;
}

async function imagenABase64(url: string): Promise<ImagenData | null> {
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

/**
 * Cadena de proveedores de IA, en orden de preferencia. Los tres tienen
 * tier gratis con soporte de imágenes. Se prueba el siguiente solo cuando
 * el anterior falla (cuota agotada, sobrecarga persistente, error de red,
 * JSON inválido, etc.) o directamente no tiene API key configurada en
 * Vercel — así el sitio sigue funcionando con 1 o 2 proveedores dados de
 * alta, sin tocar código, y de yapa cuando agreguemos uno nuevo alcanza
 * con sumarlo a este array.
 */
function construirCadenaProveedores(): Array<{
  nombre: string;
  llamar: (prompt: string, imagenes: ImagenData[]) => Promise<ResultadoProveedor>;
}> {
  const cadena: Array<{ nombre: string; llamar: (prompt: string, imagenes: ImagenData[]) => Promise<ResultadoProveedor> }> = [];

  if (process.env.GEMINI_API_KEY) {
    const apiKey = process.env.GEMINI_API_KEY;
    cadena.push({ nombre: 'Gemini', llamar: (prompt, imagenes) => generarConGemini(apiKey, prompt, imagenes) });
  }
  if (process.env.GROQ_API_KEY) {
    const apiKey = process.env.GROQ_API_KEY;
    cadena.push({ nombre: 'Groq', llamar: (prompt, imagenes) => generarConGroq(apiKey, prompt, imagenes) });
  }
  if (process.env.OPENROUTER_API_KEY) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    cadena.push({ nombre: 'OpenRouter', llamar: (prompt, imagenes) => generarConOpenRouter(apiKey, prompt, imagenes) });
  }

  return cadena;
}

export async function POST(req: NextRequest) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const cadena = construirCadenaProveedores();
  if (cadena.length === 0) {
    return NextResponse.json(
      {
        error:
          'No hay ningún proveedor de IA configurado en el servidor (falta GEMINI_API_KEY, GROQ_API_KEY u OPENROUTER_API_KEY)',
      },
      { status: 500 }
    );
  }

  const body = (await req.json().catch(() => null)) as GenerarIABody | null;
  const imagenes = (body?.imagenes ?? []).slice(0, MAX_IMAGENES);
  if (imagenes.length === 0) {
    return NextResponse.json({ error: 'Subí al menos una imagen antes de generar con IA' }, { status: 422 });
  }

  // Descarga las imágenes en paralelo y las pasa a base64: ninguno de los
  // proveedores acepta URLs públicas directamente, necesitan los bytes
  // inline en la request.
  const imagenesData = (await Promise.all(imagenes.map(imagenABase64))).filter(
    (i): i is ImagenData => i !== null
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

  const errores: string[] = [];

  for (const proveedor of cadena) {
    const resultado = await proveedor.llamar(prompt, imagenesData);
    if (resultado.ok) {
      return NextResponse.json(resultado.contenido);
    }
    console.error(`[generar-ia] Falló ${proveedor.nombre}:`, resultado.motivo);
    errores.push(`${proveedor.nombre}: ${resultado.motivo}`);
  }

  // Los 3 (o los que estén configurados) fallaron. Si el último motivo fue
  // cuota agotada (429) en todos, el mensaje suele ser el más útil para el
  // admin; si no, mostramos un resumen corto de la cadena completa.
  const huboCuotaAgotada = errores.some((e) => e.includes('(429)'));
  const mensaje = huboCuotaAgotada
    ? 'Se agotó la cuota gratis de los proveedores de IA disponibles por ahora. Probá de nuevo en unos minutos.'
    : `No se pudo generar el contenido con ningún proveedor de IA disponible. Detalle: ${errores.join(' | ')}`;

  return NextResponse.json({ error: mensaje }, { status: 502 });
}