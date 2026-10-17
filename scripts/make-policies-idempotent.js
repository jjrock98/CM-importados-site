#!/usr/bin/env node
/**
 * Hace re-ejecutable sql/schema.sql: antes de cada CREATE POLICY inserta un
 * DROP POLICY IF EXISTS equivalente (mismo nombre, misma tabla).
 *
 * Uso (desde la raíz del repo):
 *   node scripts/make-policies-idempotent.js sql/schema.sql
 *
 * Modifica el archivo en el lugar y deja una copia en sql/schema.sql.bak.
 * Es seguro correrlo más de una vez: no duplica los DROP que ya existan.
 */
const fs = require('fs');

const file = process.argv[2];
if (!file) {
  console.error('Uso: node scripts/make-policies-idempotent.js sql/schema.sql');
  process.exit(1);
}

const src = fs.readFileSync(file, 'utf8');
const CREATE = /^([ \t]*)CREATE\s+POLICY\s+"([^"]+)"\s+ON\s+([\w."]+)/gim;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

let out = '';
let last = 0;
let added = 0;
let m;

while ((m = CREATE.exec(src)) !== null) {
  const [, indent, name, table] = m;
  const before = src.slice(Math.max(0, m.index - 300), m.index);
  const dropRe = new RegExp(
    `DROP\\s+POLICY\\s+IF\\s+EXISTS\\s+"${esc(name)}"\\s+ON\\s+${esc(table)}\\s*;\\s*$`,
    'i'
  );
  if (dropRe.test(before)) continue;
  out += src.slice(last, m.index);
  out += `${indent}DROP POLICY IF EXISTS "${name}" ON ${table};\n`;
  last = m.index;
  added++;
}
out += src.slice(last);

if (added === 0) {
  console.log('Nada que cambiar: todas las policies ya tienen su DROP POLICY IF EXISTS.');
  process.exit(0);
}

fs.copyFileSync(file, file + '.bak');
fs.writeFileSync(file, out, 'utf8');
console.log(`${added} DROP POLICY IF EXISTS agregados en ${file} (copia: ${file}.bak)`);