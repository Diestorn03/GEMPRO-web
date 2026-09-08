/**
 * Comprueba con un decodificador real (jsQR) que el QR con el isotipo al centro se lee y apunta a
 * /evento, en tres versiones: el PNG de 2400 px, ese mismo PNG reducido a 360 px y desenfocado
 * (simula una impresión mediocre fotografiada de lejos) y el SVG rasterizado.
 * Uso: node scripts/probar-qr.mjs [base=http://127.0.0.1:4321] [carpeta de salida]
 * Necesita el servidor corriendo y ADMIN_PASSWORD (por defecto la de .env local).
 */
import sharp from 'sharp';
import jsQR from 'jsqr';
import fs from 'node:fs';

const BASE = process.argv[2] || 'http://127.0.0.1:4321';
const OUT = process.argv[3] || '.qr-prueba';
const PASS = process.env.ADMIN_PASSWORD || 'gempro-local-temp';
fs.mkdirSync(OUT, { recursive: true });

const login = await fetch(BASE + '/api/entrar', { method: 'POST', body: new URLSearchParams({ password: PASS }), headers: { Origin: BASE }, redirect: 'manual' });
const cookie = login.headers.get('set-cookie')?.split(';')[0];
if (!cookie || login.headers.get('location') !== '/panel') throw new Error(`No se pudo entrar: ${login.status} → ${login.headers.get('location')}`);

async function decodificar(buffer, etiqueta) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const r = jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), info.width, info.height);
  console.log(`${etiqueta.padEnd(42)} ${info.width}x${info.height} → ${r ? r.data : 'NO SE LEE'}`);
  return r?.data;
}

const esperado = BASE + '/evento';
const png = Buffer.from(await (await fetch(BASE + '/api/panel/qr?formato=png', { headers: { cookie } })).arrayBuffer());
fs.writeFileSync(`${OUT}/qr.png`, png);
const svg = await (await fetch(BASE + '/api/panel/qr?formato=svg', { headers: { cookie } })).text();
fs.writeFileSync(`${OUT}/qr.svg`, svg);
const svgPng = await sharp(Buffer.from(svg)).resize(900).png().toBuffer();
fs.writeFileSync(`${OUT}/qr-desde-svg.png`, svgPng);

const resultados = [
  await decodificar(png, 'PNG 2400 px'),
  await decodificar(await sharp(png).resize(360).blur(0.8).png().toBuffer(), 'PNG a 360 px + desenfoque (impresión mala)'),
  await decodificar(svgPng, 'SVG rasterizado a 900 px'),
];
if (resultados.some((r) => r !== esperado)) { console.error('FALLO: algún QR no se lee o apunta a otra URL'); process.exit(1); }
console.log('OK: los tres se leen y apuntan a', esperado);
