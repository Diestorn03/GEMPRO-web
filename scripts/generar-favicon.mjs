/**
 * Favicon y iconos de app a partir del isotipo de GEMPRO (el favicon anterior era el corazón de
 * Lovable, copiado del sitio viejo). Toma el óvalo central con la G (el isotipo completo es muy
 * ancho para un cuadrado de 16 px) sobre el azul marino del sitio.
 * Uso puntual: node scripts/generar-favicon.mjs
 */
import sharp from 'sharp';
import fs from 'node:fs';

const ISO = 'src/assets/logos/isotipo-gempro.png';
const NAVY = '#061426';
const meta = await sharp(ISO).metadata();
const x0 = Math.round(meta.width * 0.24), x1 = Math.round(meta.width * 0.8);
const ovalo = await sharp(ISO).extract({ left: x0, top: 0, width: x1 - x0, height: meta.height }).png().toBuffer();

async function icono(lado, borde) {
  const util = Math.round(lado * (1 - 2 * borde));
  const marca = await sharp(ovalo).resize({ width: util, height: util, fit: 'inside' }).png().toBuffer();
  const m = await sharp(marca).metadata();
  return sharp({ create: { width: lado, height: lado, channels: 4, background: NAVY } })
    .composite([{ input: marca, left: Math.round((lado - m.width) / 2), top: Math.round((lado - m.height) / 2) }]).png().toBuffer();
}

const png48 = await icono(48, 0.05);
fs.writeFileSync('public/favicon-192.png', await icono(192, 0.1));
fs.writeFileSync('public/apple-touch-icon.png', await icono(180, 0.12));
// ICO moderno: contenedor ICO con un PNG de 48 px dentro (lo leen todos los navegadores actuales).
const cab = Buffer.alloc(6); cab.writeUInt16LE(1, 2); cab.writeUInt16LE(1, 4);
const ent = Buffer.alloc(16); ent[0] = 48; ent[1] = 48; ent.writeUInt16LE(1, 4); ent.writeUInt16LE(32, 6); ent.writeUInt32LE(png48.length, 8); ent.writeUInt32LE(22, 12);
fs.writeFileSync('public/favicon.ico', Buffer.concat([cab, ent, png48]));
console.log('favicon.ico, favicon-192.png y apple-touch-icon.png generados');
