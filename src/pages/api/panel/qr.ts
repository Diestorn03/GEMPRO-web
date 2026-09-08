export const prerender = false;

import type { APIRoute } from 'astro';
import { estaAutenticado } from '../../../lib/auth';
import { qrPng, qrSvg } from '../../../lib/qr';

/** Descarga del QR del evento con logo: ?formato=png (2400 px) o ?formato=svg (vectorial). */
export const GET: APIRoute = async ({ cookies, url, redirect }) => {
  if (!estaAutenticado(cookies)) return redirect('/entrar', 303);
  const urlEvento = `${url.origin}/evento`;
  if (url.searchParams.get('formato') === 'svg') {
    return new Response(await qrSvg(urlEvento), { headers: { 'Content-Type': 'image/svg+xml', 'Content-Disposition': 'attachment; filename="qr-evento-gempro.svg"' } });
  }
  const png = await qrPng(urlEvento, 2400);
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png', 'Content-Disposition': 'attachment; filename="qr-evento-gempro.png"' } });
};
