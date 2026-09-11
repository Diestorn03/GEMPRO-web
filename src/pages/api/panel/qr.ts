export const prerender = false;

import type { APIRoute } from 'astro';
import { estaAutenticado } from '../../../lib/auth';
import { qrPng, qrSvg, type EstiloQr } from '../../../lib/qr';
import { origenPublico } from '../../../data/site';

/** Descarga del QR del evento: ?formato=png|svg & ?estilo=gempro|clasico. */
export const GET: APIRoute = async ({ cookies, url, redirect }) => {
  if (!estaAutenticado(cookies)) return redirect('/entrar', 303);
  const urlEvento = `${origenPublico(url.origin)}/evento`;
  const estilo: EstiloQr = url.searchParams.get('estilo') === 'clasico' ? 'clasico' : 'gempro';
  const nombre = `qr-evento-gempro-${estilo}`;
  if (url.searchParams.get('formato') === 'svg') {
    return new Response(await qrSvg(urlEvento, estilo), { headers: { 'Content-Type': 'image/svg+xml', 'Content-Disposition': `attachment; filename="${nombre}.svg"` } });
  }
  const png = await qrPng(urlEvento, estilo, 2400);
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png', 'Content-Disposition': `attachment; filename="${nombre}.png"` } });
};
