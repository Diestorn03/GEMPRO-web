/**
 * Genera la versión "blanco" del logo (para fondos oscuros) a partir del logo maestro a color.
 * La versión anterior era un recorte de color tosco a baja resolución (720x184) que se veía
 * borroso y hasta descoloría las banderitas; el cliente lo reportó como "no se lee bien".
 *
 * Regla: el azul marino del wordmark y de los anillos exteriores se pierde contra el fondo
 * oscuro del sitio (--color-ink: #061426), así que se convierte a blanco puro. El verde de
 * marca sí contrasta bien sobre ese fondo y se deja igual. Se parte del lockup a color de mayor
 * resolución que ya existe (1835x468), así que el resultado queda nítido a cualquier tamaño de
 * uso en el sitio (Nav a 52px, Footer a 46px de alto).
 *
 * Volver a correr si algún día se reemplaza el logo maestro: `node scripts/generar-logo-blanco.mjs`
 */
import sharp from 'sharp';

const ORIGEN = 'src/assets/logos/logo-gempro.png';
const DESTINO = 'src/assets/logos/logo-gempro-blanco.png';

const { data, info } = await sharp(ORIGEN).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;

for (let i = 0; i < data.length; i += channels) {
  const r = data[i], g = data[i + 1], b = data[i + 2];
  if (b > g && b > r + 10) {
    data[i] = 255; data[i + 1] = 255; data[i + 2] = 255;
  }
}

await sharp(data, { raw: { width, height, channels } }).png().toFile(DESTINO);
console.log(`Listo: ${DESTINO} (${width}x${height})`);
