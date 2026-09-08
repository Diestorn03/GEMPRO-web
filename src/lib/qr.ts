/**
 * QR del evento con el isotipo de GEMPRO al centro (estilo WhatsApp), listo para imprimir.
 * Corrección de errores nivel H: el código sigue leyéndose aunque se pierda hasta el 30 % de sus
 * módulos. El isotipo es ancho (≈2.9:1), así que va en una placa blanca redondeada de su misma
 * proporción: ≈34 % del lado de ancho y ≈14 % de alto, apenas un 5 % del área del código.
 * Verificado con un decodificador real en scripts/probar-qr.mjs.
 */
import QRCode from 'qrcode';
import sharp from 'sharp';
import isotipo from '../assets/logos/isotipo-gempro.png?inline';

const AZUL = '#061426';
const LOGO = 0.3; // ancho del isotipo como fracción del lado del QR (placa ≈34 % × 14 %, ≈5 % del área)
const RELLENO = 0.14; // margen blanco alrededor del isotipo, como fracción de su ancho

const isotipoPng = Buffer.from(isotipo.split(',')[1], 'base64');
let proporcion: Promise<number> | null = null; // alto / ancho del isotipo
function altoSobreAncho(): Promise<number> {
  return (proporcion ??= sharp(isotipoPng).metadata().then((m) => (m.height ?? 1) / (m.width ?? 1)));
}

function opciones(width?: number) {
  return { errorCorrectionLevel: 'H' as const, margin: 4, color: { dark: AZUL, light: '#ffffff' }, ...(width ? { width } : {}) };
}

/** Geometría de la placa y el isotipo para un QR de `lado` unidades. */
async function placa(lado: number) {
  const ancho = lado * LOGO;
  const alto = ancho * (await altoSobreAncho());
  const relleno = ancho * RELLENO;
  return { logoX: (lado - ancho) / 2, logoY: (lado - alto) / 2, logoAncho: ancho, logoAlto: alto, x: (lado - ancho) / 2 - relleno, y: (lado - alto) / 2 - relleno, w: ancho + 2 * relleno, h: alto + 2 * relleno, rx: (alto + 2 * relleno) * 0.28 };
}

/** PNG cuadrado de `ancho` píxeles (2400 ≈ 20 cm a 300 dpi). */
export async function qrPng(url: string, ancho = 2400): Promise<Buffer> {
  const base = await QRCode.toBuffer(url, opciones(ancho));
  const p = await placa(ancho);
  const r = (n: number) => Math.round(n);
  const logo = await sharp(isotipoPng).resize(r(p.logoAncho), r(p.logoAlto), { fit: 'fill' }).png().toBuffer();
  const fondo = Buffer.from(`<svg width="${r(p.w)}" height="${r(p.h)}"><rect width="${r(p.w)}" height="${r(p.h)}" rx="${r(p.rx)}" fill="#fff"/></svg>`);
  return sharp(base)
    .composite([{ input: fondo, left: r(p.x), top: r(p.y) }, { input: logo, left: r(p.logoX), top: r(p.logoY) }])
    .png().toBuffer();
}

/** SVG: módulos vectoriales + isotipo incrustado. Para imprenta a cualquier tamaño sin perder nitidez. */
export async function qrSvg(url: string): Promise<string> {
  const svg = await QRCode.toString(url, { ...opciones(), type: 'svg' });
  const lado = Number(svg.match(/viewBox="0 0 (\d+) \d+"/)?.[1] ?? 0);
  const p = await placa(lado);
  const f = (n: number) => n.toFixed(3);
  const extra =
    `<rect x="${f(p.x)}" y="${f(p.y)}" width="${f(p.w)}" height="${f(p.h)}" rx="${f(p.rx)}" fill="#fff"/>` +
    `<image href="${isotipo}" x="${f(p.logoX)}" y="${f(p.logoY)}" width="${f(p.logoAncho)}" height="${f(p.logoAlto)}" preserveAspectRatio="xMidYMid meet"/>`;
  return svg.replace('</svg>', extra + '</svg>');
}
