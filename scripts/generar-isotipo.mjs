/**
 * Recorta el isotipo (símbolo sin el texto "GEMPRO") del logo maestro a color de la carpeta
 * de identidad y lo guarda en src/assets/logos/isotipo-gempro.png. Se usa al centro del QR.
 * Uso puntual: node scripts/generar-isotipo.mjs
 */
import sharp from 'sharp';

const SRC = 'C:/Users/Diestorn/Desktop/identidad GemPro/LOGO PNG/GEMPRO PNG_Mesa de trabajo 1.png';
const OUT = 'src/assets/logos/isotipo-gempro.png';

const { data, info } = await sharp(SRC).trim().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
// Primer hueco de ≥15 filas transparentes tras el contenido = separación entre el símbolo y el texto.
let fin = -1, vacias = 0;
for (let y = 0; y < info.height; y++) {
  let n = 0;
  for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] > 20) { n = 1; break; }
  if (n === 0) { vacias++; if (vacias >= 15) { fin = y - vacias + 1; break; } } else vacias = 0;
}
if (fin < 50) throw new Error('No se encontró la separación entre símbolo y texto (fila ' + fin + ')');
const recortado = await sharp(SRC).trim().png().toBuffer();
await sharp(recortado).extract({ left: 0, top: 0, width: info.width, height: fin }).trim().resize({ width: 1200, fit: 'inside' }).png().toFile(OUT);
const m = await sharp(OUT).metadata();
console.log(`isotipo: ${m.width}x${m.height} (recorte hasta la fila ${fin} de ${info.height})`);
