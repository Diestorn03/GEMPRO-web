/**
 * Comprueba con dos decodificadores reales que el QR del evento se lee y apunta a /evento, en
 * los dos estilos (gempro y clasico) y en tres versiones cada uno: el PNG de 2400 px, ese PNG
 * reducido a 360 px y desenfocado (impresión mediocre fotografiada de lejos) y el SVG rasterizado.
 * - ZXing (la base de la mayoría de lectores de Android) decodifica cada imagen tal cual.
 * - jsQR modela una cámara de teléfono: nunca ve módulos de 60 px, así que las imágenes grandes
 *   se le pasan reducidas a 1200 px (a más resolución su binarizador por bloques falla con
 *   colores que no son negro puro; no es un defecto del código).
 * Uso: node scripts/probar-qr.mjs [base=http://127.0.0.1:4321] [carpeta de salida]
 * Necesita el servidor corriendo y ADMIN_PASSWORD (por defecto la de .env local).
 */
import sharp from 'sharp';
import jsQR from 'jsqr';
import zxing from '@zxing/library';
import fs from 'node:fs';

const { RGBLuminanceSource, BinaryBitmap, HybridBinarizer, QRCodeReader } = zxing;
const BASE = process.argv[2] || 'http://127.0.0.1:4321';
const OUT = process.argv[3] || '.qr-prueba';
const PASS = process.env.ADMIN_PASSWORD || 'gempro-local-temp';
fs.mkdirSync(OUT, { recursive: true });

const login = await fetch(BASE + '/api/entrar', { method: 'POST', body: new URLSearchParams({ password: PASS }), headers: { Origin: BASE }, redirect: 'manual' });
const cookie = login.headers.get('set-cookie')?.split(';')[0];
if (!cookie || login.headers.get('location') !== '/panel') throw new Error(`No se pudo entrar: ${login.status} → ${login.headers.get('location')}`);

async function conZxing(buffer) {
  const { data, info } = await sharp(buffer).flatten({ background: '#fff' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const gris = new Uint8ClampedArray(info.width * info.height);
  for (let i = 0; i < gris.length; i++) gris[i] = (data[i * 3] * 299 + data[i * 3 + 1] * 587 + data[i * 3 + 2] * 114) / 1000;
  try { return new QRCodeReader().decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(gris, info.width, info.height)))).getText(); } catch { return null; }
}
async function conJsqr(buffer) {
  const meta = await sharp(buffer).metadata();
  const img = meta.width > 1200 ? sharp(buffer).resize(1200) : sharp(buffer);
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), info.width, info.height)?.data ?? null;
}
async function probar(buffer, etiqueta) {
  const [z, j] = [await conZxing(buffer), await conJsqr(buffer)];
  const ok = (v) => (v === esperado ? 'OK' : v ? 'OTRA URL: ' + v : 'NO SE LEE');
  console.log(`${etiqueta.padEnd(36)} ZXing: ${ok(z).padEnd(10)} jsQR: ${ok(j)}`);
  return z === esperado && j === esperado;
}

const esperado = BASE + '/evento';
const resultados = [];
for (const estilo of ['gempro', 'clasico']) {
  const png = Buffer.from(await (await fetch(`${BASE}/api/panel/qr?formato=png&estilo=${estilo}`, { headers: { cookie } })).arrayBuffer());
  fs.writeFileSync(`${OUT}/qr-${estilo}.png`, png);
  const svg = await (await fetch(`${BASE}/api/panel/qr?formato=svg&estilo=${estilo}`, { headers: { cookie } })).text();
  fs.writeFileSync(`${OUT}/qr-${estilo}.svg`, svg);
  const svgPng = await sharp(Buffer.from(svg.replace(/width="\d+" height="\d+"/, 'width="900" height="900"'))).png().toBuffer();
  fs.writeFileSync(`${OUT}/qr-${estilo}-desde-svg.png`, svgPng);
  resultados.push(
    await probar(png, `[${estilo}] PNG 2400 px`),
    await probar(await sharp(png).resize(360).blur(0.8).png().toBuffer(), `[${estilo}] PNG 360 px + desenfoque`),
    await probar(svgPng, `[${estilo}] SVG rasterizado a 900 px`),
  );
}
if (resultados.includes(false)) { console.error('FALLO: alguna versión no se lee o apunta a otra URL'); process.exit(1); }
console.log('OK: las seis versiones se leen con ambos decodificadores y apuntan a', esperado);
