#!/usr/bin/env node
/**
 * Agrega `await` a las llamadas `rateLimiters.xxx(req)` en src/ (ahora son
 * asíncronas). Idempotente: no toca las que ya tienen await ni los comentarios.
 *
 * Uso (desde la raíz del repo):  node scripts/add-await-ratelimit.js
 * Después: git diff   y   npx tsc --noEmit
 */
const fs = require('fs');
const path = require('path');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' || e.name === '__tests__' ? [] : walk(p);
    return /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
}

const RE = /(?<!await\s)(?<![\w.`])rateLimiters\.\w+\(\s*\w+\s*\)/g;
let total = 0;
for (const file of walk('src')) {
  if (file.replace(/\\/g, '/').endsWith('src/lib/rateLimit.ts')) continue;
  const src = fs.readFileSync(file, 'utf8');
  const lines = src.split(/(\r?\n)/);
  let changed = 0;
  for (let i = 0; i < lines.length; i += 2) {
    const l = lines[i];
    if (/^\s*(\/\/|\*|\/\*)/.test(l)) continue; // comentarios
    lines[i] = l.replace(RE, (m) => { changed++; return 'await ' + m; });
  }
  if (changed) {
    fs.writeFileSync(file, lines.join(''), 'utf8');
    console.log(`${changed} cambio(s): ${file}`);
    total += changed;
  }
}
console.log(total ? `Listo: ${total} llamada(s) con await.` : 'Nada que cambiar (ya tienen await).');