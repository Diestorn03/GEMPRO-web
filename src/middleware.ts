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
  // Formularios enviados por fetch (data-ajax): un 303 haría que fetch descargue y renderice la
  // página destino solo para descartarla y volver a pedirla al asignar location.href. Se devuelve
  // 204 con la ruta en una cabecera y el navegador navega una sola vez. Las cookies que la ruta
  // haya puesto (sesión) las adjunta Astro a esta respuesta igual que a la original.
  if (res.status >= 300 && res.status < 400 && ctx.request.headers.get('x-peticion-ajax') === '1') {
    return new Response(null, { status: 204, headers: { 'X-Redirigir': res.headers.get('location') ?? '/', 'Cache-Control': 'no-store' } });
  }
  try { res.headers.set('X-Content-Type-Options', 'nosniff'); } catch { res = new Response(res.body, res); }
  for (const [k, v] of Object.entries(CABECERAS)) res.headers.set(k, v);
  if (PRIVADAS.some((p) => ctx.url.pathname.startsWith(p))) res.headers.set('Cache-Control', 'private, no-store');
  return res;
});
