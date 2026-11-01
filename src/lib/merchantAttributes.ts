/**
 * Atributos de indumentaria y calzado para Google Merchant Center: público (género y
 * edad), color y categoría de Google. Lógica pura y con tests (src/__tests__/merchantAttributes.test.ts).
 *
 * IMPORTANTE: la tienda no tiene campos de "género" ni "edad" en cada producto, así que se
 * DEDUCEN del nombre y de la descripción corta ("Mujer", "Niños", "de dama"…). Si no hay
 * ninguna pista, el producto se publica como UNISEX / ADULT. Para afinarlo, basta con
 * escribir la pista en el nombre del producto (ej. "…Hombre").
 */

export type GeneroGoogle = 'MALE' | 'FEMALE' | 'UNISEX';
export type EdadGoogle   = 'INFANT' | 'KIDS' | 'ADULT';

/** Minúsculas y sin acentos, para comparar ("Niño" → "nino"). */
const normalizar = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const RE_MUJER  = /\b(mujer|mujeres|dama|damas|femenin[oa]s?|nena|nenas)\b/;
const RE_HOMBRE = /\b(hombre|hombres|caballero|caballeros|varon|varones|masculin[oa]s?)\b/;
const RE_NINIA  = /\b(nina|ninas)\b/;
const RE_NINIO  = /\b(nino|ninos)\b/;
const RE_KIDS   = /\b(infantil|infantiles|kids|juvenil|juveniles|chicos|chicas)\b/;
const RE_BEBE   = /\b(bebe|bebes)\b/;

export function deducirPublico(texto: string): { gender: GeneroGoogle; ageGroup: EdadGoogle } {
  const t = normalizar(texto);

  const ageGroup: EdadGoogle =
    RE_BEBE.test(t) ? 'INFANT'
    : RE_NINIA.test(t) || RE_NINIO.test(t) || RE_KIDS.test(t) ? 'KIDS'
    : 'ADULT';

  // "niña(s)" → mujer; "niño" (singular) → hombre. "Niños" en plural es genérico (chicos y
  // chicas), por eso no define el género: queda UNISEX con edad KIDS.
  const mujer  = RE_MUJER.test(t)  || RE_NINIA.test(t);
  const hombre = RE_HOMBRE.test(t) || /\bnino\b/.test(t);

  const gender: GeneroGoogle = mujer && !hombre ? 'FEMALE' : hombre && !mujer ? 'MALE' : 'UNISEX';
  return { gender, ageGroup };
}

/**
 * Color para Google: un producto con 1 a 3 colores los lleva separados por "/" (formato
 * que Google acepta para artículos multicolor); con más de 3 se informa "Multicolor".
 * Sin colores cargados, no se envía el campo.
 */
export function colorParaGoogle(colores: string[] | null | undefined): string | undefined {
  const limpios = (colores ?? []).map((c) => c.trim()).filter(Boolean);
  if (limpios.length === 0) return undefined;
  if (limpios.length === 1) return limpios[0];
  return limpios.length <= 3 ? limpios.join('/') : 'Multicolor';
}

/** Categorías de la tienda → ID de la taxonomía de Google (Apparel & Accessories…). */
const CATEGORIA_GOOGLE: Record<string, string> = {
  calzado:    '187', // Indumentaria y accesorios > Calzado
  pantalones: '204', // … > Ropa > Pantalones
  bermudas:   '207', // … > Ropa > Shorts
  remeras:    '212', // … > Ropa > Camisetas y tops
};

export function categoriaGoogle(categoria: string | null | undefined): string | undefined {
  return categoria ? CATEGORIA_GOOGLE[categoria] : undefined;
}

/** Texto de talles y colores para sumar a la descripción (Google lo lee de ahí). */
export function textoVariantes(talles: string[] | null | undefined, colores: string[] | null | undefined): string {
  const t = (talles ?? []).map((x) => x.trim()).filter(Boolean);
  const c = (colores ?? []).map((x) => x.trim()).filter(Boolean);
  const partes: string[] = [];
  if (t.length) partes.push(`Talles: ${t.join(', ')}.`);
  if (c.length) partes.push(`Colores: ${c.join(', ')}.`);
  return partes.join(' ');
}