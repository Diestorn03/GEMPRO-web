/**
 * Comprueba que la Content-Security-Policy de vercel.json autoriza cada <script> incrustado en el
 * HTML compilado (los dos <script is:inline> del sitio). Si alguien edita uno de esos scripts,
 * su hash cambia y el navegador lo bloquearía en silencio: este script lo detecta.
 * Uso: npm run build && node scripts/csp-hashes.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const raiz = '.vercel/output/static';
const htmls = [];
(function andar(d) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) andar(p);
    else if (n.endsWith('.html')) htmls.push(p);
  }
})(raiz);

const hashes = new Map();
for (const p of htmls) {
  for (const m of readFileSync(p, 'utf8').matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/ld\+json/.test(m[1])) continue; // bloque de datos, la CSP no lo ejecuta ni lo restringe
    hashes.set(`'sha256-${createHash('sha256').update(m[2]).digest('base64')}'`, m[2].trim().slice(0, 70).replace(/\s+/g, ' '));
  }
}

const csp = JSON.parse(readFileSync('vercel.json', 'utf8')).headers.flatMap((r) => r.headers).find((h) => h.key === 'Content-Security-Policy').value;
let faltan = 0;
for (const [h, texto] of hashes) {
  const ok = csp.includes(h);
  if (!ok) faltan++;
  console.log(ok ? 'ok    ' : 'FALTA ', h, '←', texto);
}
console.log(`${htmls.length} páginas, ${hashes.size} scripts incrustados distintos, ${faltan} sin autorizar`);
if (faltan) { console.error('Agregar a script-src en vercel.json los hashes marcados FALTA.'); process.exit(1); }
