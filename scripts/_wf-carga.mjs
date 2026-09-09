// Prueba de carga prudente contra producción. Node 22, fetch nativo. Se borra al terminar.
import { mkdir, writeFile } from 'node:fs/promises';

const BASE = 'https://gempro-web.vercel.app';
const SALIDA = 'C:/Users/Diestorn/AppData/Local/Temp/claude/C--Users-Diestorn-Desktop-Kindra-Project/054c149b-8412-4bde-9142-34e3bccb858e/scratchpad/wf/carga/resultados.json';
const TIMEOUT = 30_000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function pedir(ruta, init = {}) {
  const t0 = performance.now();
  const r = { ruta, status: null, ttfb_ms: null, total_ms: null, cache: null, error: null, body: null };
  try {
    const res = await fetch(BASE + ruta, { ...init, signal: AbortSignal.timeout(TIMEOUT), redirect: 'manual' });
    r.ttfb_ms = Math.round(performance.now() - t0);
    r.status = res.status;
    r.cache = res.headers.get('x-vercel-cache');
    const texto = await res.text();
    r.total_ms = Math.round(performance.now() - t0);
    if (ruta.startsWith('/api/salud')) { try { r.body = JSON.parse(texto); } catch { /* no JSON */ } }
    if (ruta.startsWith('/api/evento')) r.body = texto.slice(0, 200);
  } catch (e) {
    r.total_ms = Math.round(performance.now() - t0);
    r.error = e.name === 'TimeoutError' ? 'timeout' : `${e.name}: ${e.message}`;
  }
  return r;
}

const pct = (arr, p) => { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]; };
const stats = (arr) => ({ n: arr.length, p50: pct(arr, 50), p95: pct(arr, 95), max: arr.length ? Math.max(...arr) : null, min: arr.length ? Math.min(...arr) : null });

function resumir(nombre, res) {
  const ok = res.filter((r) => !r.error);
  const porRuta = {};
  for (const r of res) {
    const k = r.ruta.split('?')[0];
    (porRuta[k] ??= []).push(r);
  }
  const resumen = {
    escenario: nombre,
    peticiones: res.length,
    ttfb: stats(ok.map((r) => r.ttfb_ms)),
    total: stats(ok.map((r) => r.total_ms)),
    status: Object.fromEntries(Object.entries(Object.groupBy(res, (r) => r.status ?? 'error')).map(([k, v]) => [k, v.length])),
    cache: Object.fromEntries(Object.entries(Object.groupBy(res, (r) => r.cache ?? 'sin-cabecera')).map(([k, v]) => [k, v.length])),
    errores: res.filter((r) => r.error).map((r) => r.error),
  };
  if (Object.keys(porRuta).length > 1) {
    resumen.por_ruta = Object.fromEntries(Object.entries(porRuta).map(([k, v]) => [k, {
      ttfb: stats(v.filter((r) => !r.error).map((r) => r.ttfb_ms)),
      total: stats(v.filter((r) => !r.error).map((r) => r.total_ms)),
      status: Object.fromEntries(Object.entries(Object.groupBy(v, (r) => r.status ?? 'error')).map(([s, w]) => [s, w.length])),
      cache: Object.fromEntries(Object.entries(Object.groupBy(v, (r) => r.cache ?? 'sin-cabecera')).map(([s, w]) => [s, w.length])),
    }]));
  }
  const lat = ok.map((r) => r.body?.latencia_bd_ms).filter((x) => typeof x === 'number' && x >= 0);
  if (lat.length) resumen.latencia_bd_ms = stats(lat);
  const regiones = ok.map((r) => r.body?.region).filter(Boolean);
  if (regiones.length) resumen.regiones = Object.fromEntries(Object.entries(Object.groupBy(regiones, (x) => x)).map(([k, v]) => [k, v.length]));
  return resumen;
}

const escenarios = [
  { nombre: '1 calentamiento: 5 secuenciales /noticias', run: async () => { const out = []; for (let i = 0; i < 5; i++) out.push(await pedir('/noticias')); return out; } },
  { nombre: '2 20 simultáneas /noticias', run: () => Promise.all(Array.from({ length: 20 }, () => pedir('/noticias'))) },
  { nombre: '3 50 simultáneas /noticias', run: () => Promise.all(Array.from({ length: 50 }, () => pedir('/noticias'))) },
  { nombre: '4 100 simultáneas mixtas (25 c/u: /, /noticias, /evento, /servicios)', run: () => Promise.all(['/', '/noticias', '/evento', '/servicios'].flatMap((r) => Array.from({ length: 25 }, () => pedir(r)))) },
  { nombre: '5 30 simultáneas /api/salud', run: () => Promise.all(Array.from({ length: 30 }, () => pedir('/api/salud'))) },
  { nombre: '6 60 simultáneas POST /api/evento inválido', run: () => Promise.all(Array.from({ length: 60 }, () => pedir('/api/evento', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: BASE },
    body: JSON.stringify({ nombre: '', correo: 'x' }),
  }))) },
];

const resultados = { inicio: new Date().toISOString(), base: BASE, escenarios: [] };
let total = 0;
for (const [i, e] of escenarios.entries()) {
  if (i) await sleep(5000);
  console.log(`\n>> ${e.nombre}`);
  const t0 = performance.now();
  const res = await e.run();
  total += res.length;
  const resumen = resumir(e.nombre, res);
  resumen.duracion_escenario_ms = Math.round(performance.now() - t0);
  resultados.escenarios.push({ resumen, crudo: res });
  console.log(JSON.stringify(resumen, null, 1));
}
resultados.fin = new Date().toISOString();
resultados.total_peticiones = total;
await mkdir(SALIDA.slice(0, SALIDA.lastIndexOf('/')), { recursive: true });
await writeFile(SALIDA, JSON.stringify(resultados, null, 2));
console.log(`\nTotal peticiones: ${total}. JSON en ${SALIDA}`);
