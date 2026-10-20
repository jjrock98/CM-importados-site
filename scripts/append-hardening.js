#!/usr/bin/env node
/**
 * Agrega al FINAL de sql/schema.sql los parches de sql/fixes/ (así un
 * schema nuevo desde cero también queda con todos los fixes).
 *
 * Uso (desde la raíz del repo):
 *   node scripts/append-hardening.js
 *
 * - Hace copia de seguridad en sql/schema.sql.bak2
 * - No duplica: si el parche ya está agregado, lo saltea.
 */
const fs = require('fs');

const SCHEMA = 'sql/schema.sql';
const PATCHES = [
  'sql/fixes/2026-10-16_hardening.sql',
  'sql/fixes/2026-10-16_bank_info_private.sql',
  'sql/fixes/2026-10-16_push_subscriptions_origin.sql',
  'sql/fixes/2026-10-19_schema_sync.sql'
];

if (!fs.existsSync(SCHEMA)) { console.error(`No encuentro ${SCHEMA}. Corré esto desde la raíz del proyecto.`); process.exit(1); }

let schema = fs.readFileSync(SCHEMA, 'utf8');
const original = schema;

for (const patch of PATCHES) {
  if (!fs.existsSync(patch)) { console.error(`Falta ${patch} — copialo a esa ruta y volvé a correr.`); process.exit(1); }
  const marker = `-- >>> PARCHE: ${patch}`;
  if (schema.includes(marker)) { console.log(`Ya estaba agregado: ${patch}`); continue; }
  const body = fs.readFileSync(patch, 'utf8').trimEnd();
  schema = schema.trimEnd() + `\n\n\n${marker}\n${body}\n-- <<< FIN PARCHE: ${patch}\n`;
  console.log(`Agregado: ${patch}`);
}

if (schema === original) { console.log('Nada que cambiar.'); process.exit(0); }

fs.copyFileSync(SCHEMA, SCHEMA + '.bak2');
fs.writeFileSync(SCHEMA, schema, 'utf8');
console.log(`Listo. Copia del original: ${SCHEMA}.bak2`);
if (!/product_reviews/.test(original)) {
  console.log('AVISO: tu schema.sql no tiene "product_reviews" — parece ser la versión vieja (la del zip), no la completa.');
}