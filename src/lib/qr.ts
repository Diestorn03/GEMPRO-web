/**
 * QR del evento en dos estilos, ambos con corrección de errores nivel H (se lee aunque falte
 * hasta el 30 % de los módulos) y verificados con un decodificador real (scripts/probar-qr.mjs):
 * - 'gempro': módulos como puntos redondeados unidos entre sí, degradado azul de marca, ojos
 *   circulares y el isotipo suelto al centro (sin recuadro: se dejan libres los módulos que tapa).
 * - 'clasico': cuadrados normales (crispEdges: sin costuras antialiasadas entre módulos, que a
 *   gran tamaño confunden a algunos lectores) con el isotipo sobre una placa blanca.
 * El SVG es la fuente única: el PNG se rasteriza desde él, así ambos son idénticos.
 */
import QRCode from 'qrcode';
import sharp from 'sharp';
import isotipo from '../assets/logos/isotipo-gempro.png?inline';

export type EstiloQr = 'gempro' | 'clasico';

const NAVY = '#061426';
const AZUL = '#1565c0';
const MARGEN = 3; // zona de silencio en módulos
const LOGO = 0.3; // ancho del isotipo como fracción del lado

const isotipoPng = Buffer.from(isotipo.split(',')[1], 'base64');
let proporcion: Promise<number> | null = null; // alto / ancho del isotipo
const altoSobreAncho = () => (proporcion ??= sharp(isotipoPng).metadata().then((m) => (m.height ?? 1) / (m.width ?? 1)));

/** SVG del QR. `px` fija width/height (para rasterizar nítido); el viewBox va en módulos. */
export async function qrSvg(url: string, estilo: EstiloQr = 'gempro', px = 1200): Promise<string> {
  const qr = QRCode.create(url, { errorCorrectionLevel: 'H' });
  const n = qr.modules.size;
  const bits = qr.modules.data;
  const lado = n + 2 * MARGEN;
  const logoAncho = lado * LOGO;
  const logoAlto = logoAncho * (await altoSobreAncho());
  const c = lado / 2;
  const holgura = estilo === 'gempro' ? 0.7 : 0.14 * logoAncho; // aire alrededor del isotipo
  const libre = { x0: c - logoAncho / 2 - holgura, x1: c + logoAncho / 2 + holgura, y0: c - logoAlto / 2 - holgura, y1: c + logoAlto / 2 + holgura };
  const oscuro = (x: number, y: number) => x >= 0 && y >= 0 && x < n && y < n && bits[y * n + x] === 1;
  const esOjo = (x: number, y: number) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
  const tapado = (x: number, y: number) => { const px = x + MARGEN + 0.5, py = y + MARGEN + 0.5; return px > libre.x0 && px < libre.x1 && py > libre.y0 && py < libre.y1; };
  const pinta = (x: number, y: number) => oscuro(x, y) && !esOjo(x, y) && !tapado(x, y);
  const f = (v: number) => +v.toFixed(3);

  let cuerpo = '';
  let ojos = '';
  let logo = `<image href="${isotipo}" x="${f(c - logoAncho / 2)}" y="${f(c - logoAlto / 2)}" width="${f(logoAncho)}" height="${f(logoAlto)}" preserveAspectRatio="xMidYMid meet"/>`;

  if (estilo === 'gempro') {
    const r = 0.46; // radio del punto (0.5 = módulos que se tocan)
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (!pinta(x, y)) continue;
      const px = x + MARGEN + 0.5, py = y + MARGEN + 0.5;
      cuerpo += `<circle cx="${px}" cy="${py}" r="${r}"/>`;
      if (pinta(x + 1, y)) cuerpo += `<rect x="${px}" y="${f(py - r)}" width="1" height="${2 * r}"/>`;
      if (pinta(x, y + 1)) cuerpo += `<rect x="${f(px - r)}" y="${py}" width="${2 * r}" height="1"/>`;
    }
    // Ojos: anillo + punto, conservando la proporción 1:1:3:1:1 que buscan los lectores.
    const ojo = (x: number, y: number) => { const cx = x + MARGEN + 3.5, cy = y + MARGEN + 3.5; return `<circle cx="${cx}" cy="${cy}" r="3.5" fill="${NAVY}"/><circle cx="${cx}" cy="${cy}" r="2.5" fill="#fff"/><circle cx="${cx}" cy="${cy}" r="1.5" fill="${NAVY}"/>`; };
    ojos = ojo(0, 0) + ojo(n - 7, 0) + ojo(0, n - 7);
  } else {
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (oscuro(x, y)) cuerpo += `<rect x="${x + MARGEN}" y="${y + MARGEN}" width="1" height="1"/>`;
    const h = libre.y1 - libre.y0;
    logo = `<rect x="${f(libre.x0)}" y="${f(libre.y0)}" width="${f(libre.x1 - libre.x0)}" height="${f(h)}" rx="${f(h * 0.28)}" fill="#fff"/>` + logo;
  }

  const relleno = estilo === 'gempro' ? 'url(#g)' : NAVY;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lado} ${lado}" width="${px}" height="${px}" shape-rendering="${estilo === 'gempro' ? 'geometricPrecision' : 'crispEdges'}">` +
    `<defs><linearGradient id="g" gradientUnits="userSpaceOnUse" x1="0" y1="${lado}" x2="${lado}" y2="0"><stop offset="0" stop-color="${NAVY}"/><stop offset="1" stop-color="${AZUL}"/></linearGradient></defs>` +
    `<rect width="${lado}" height="${lado}" fill="#fff"/><g fill="${relleno}">${cuerpo}</g>${ojos}${logo}</svg>`;
}

/** PNG cuadrado de `ancho` píxeles (2400 ≈ 20 cm a 300 dpi), rasterizado desde el SVG. */
export async function qrPng(url: string, estilo: EstiloQr = 'gempro', ancho = 2400): Promise<Buffer> {
  return sharp(Buffer.from(await qrSvg(url, estilo, ancho))).png().toBuffer();
}
