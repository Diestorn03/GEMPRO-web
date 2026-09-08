/**
 * Cabeceras de seguridad en todas las respuestas renderizadas en el servidor (panel, portal,
 * API, evento). Las páginas estáticas del sitio se sirven desde el CDN sin pasar por aquí; no
 * manejan sesión, así que no lo necesitan. Las rutas con sesión además se marcan no-store para
 * que el botón "atrás" no muestre datos privados después de salir.
 */
import { defineMiddleware } from 'astro:middleware';

const CABECERAS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};
const PRIVADAS = ['/panel', '/c/', '/api/panel', '/entrar'];

export const onRequest = defineMiddleware(async (ctx, next) => {
  let res = await next();
  try { res.headers.set('X-Content-Type-Options', 'nosniff'); } catch { res = new Response(res.body, res); }
  for (const [k, v] of Object.entries(CABECERAS)) res.headers.set(k, v);
  if (PRIVADAS.some((p) => ctx.url.pathname.startsWith(p))) res.headers.set('Cache-Control', 'private, no-store');
  return res;
});
