import { NextResponse } from 'next/server';

/**
 * DEPRECADO — este endpoint quedó huérfano.
 *
 * Reemplazado por /api/upload-comprobante (sube el archivo desde el
 * servidor con service role, funciona para invitados y usuarios
 * logueados). Ningún componente del frontend llama a esta ruta —
 * `subir-comprobante/page.tsx` usa /api/upload-comprobante.
 *
 * Además, esta ruta ya estaba rota de fondo: esperaba una URL bajo
 * /storage/v1/object/public/comprobantes/, pero ese bucket es privado
 * (ver nota en /api/upload-comprobante) — esa URL "pública" nunca la
 * iba a poder generar un cliente real. Se deja el endpoint respondiendo
 * explícitamente en vez de borrar el archivo, para no romper nada si
 * hay algún caller externo desactualizado; simplemente ya no acepta
 * comprobantes.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Este endpoint fue reemplazado por /api/upload-comprobante' },
    { status: 410 }
  );
}