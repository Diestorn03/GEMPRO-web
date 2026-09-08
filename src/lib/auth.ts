/**
 * Sesión del panel privado de GEMPRO (/panel) y verificación de contraseña de cada cliente
 * en el portal (/c/[token]). Mismo esquema ya probado y endurecido en Kindra Project:
 * - Sin AUTH_SECRET (o con menos de 16 caracteres) nadie puede entrar, en vez de firmar la
 *   sesión con una clave fija y adivinable.
 * - Las comparaciones usan hash de tamaño fijo, no largo de cadena, para no filtrar por
 *   temporización cuánto mide la contraseña real.
 * - El valor de cada cookie lleva su propia fecha de vencimiento firmada: una cookie copiada
 *   deja de servir a los 30 días aunque el navegador la conserve o alguien la reenvíe.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { AstroCookies } from 'astro';

export const COOKIE = 'gp_sesion';
export const COOKIE_CLIENTE = 'gp_cliente';
export const SESION_SEGUNDOS = 60 * 60 * 24 * 30;

function secreto(): string {
  const s = (import.meta.env.AUTH_SECRET || process.env.AUTH_SECRET) || '';
  return s.length >= 16 ? s : '';
}

function firmar(texto: string): string {
  return createHmac('sha256', secreto()).update(texto).digest('hex');
}

function igual(a: string, b: string): boolean {
  const h = (s: string) => createHash('sha256').update(s).digest();
  return timingSafeEqual(h(a), h(b));
}

/** Valida un par "vencimiento.firma": false si falta algo, ya venció o la firma no cuadra. */
function firmaVigente(exp: string | undefined, firma: string | undefined, texto: (exp: string) => string): boolean {
  if (!secreto() || !exp || !firma || !/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  return igual(firma, firmar(texto(exp)));
}

function vencimiento(): string {
  return String(Date.now() + SESION_SEGUNDOS * 1000);
}

/** Opciones comunes de las cookies de sesión. `secure` cuando la petición llegó por https
 *  (siempre en Vercel); en local por http la cookie no se enviaría y no se podría entrar. */
export function opcionesCookie(url: URL) {
  return { httpOnly: true, sameSite: 'lax' as const, secure: url.protocol === 'https:', path: '/', maxAge: SESION_SEGUNDOS };
}

export function contrasenaCorrecta(intento: string): boolean {
  const real = (import.meta.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD) || '';
  if (!secreto() || !real) return false;
  return igual(intento, real);
}

export function valorCookie(): string {
  const exp = vencimiento();
  return `${exp}.${firmar('gempro-panel:' + exp)}`;
}

export function estaAutenticado(cookies: AstroCookies): boolean {
  const [exp, firma] = (cookies.get(COOKIE)?.value ?? '').split('.');
  return firmaVigente(exp, firma, (e) => 'gempro-panel:' + e);
}

/** Contraseña propia de cada cliente del portal: hash sha256 con sal aleatoria por cliente
 *  (no se reutiliza AUTH_SECRET aquí — cada cliente tiene su propio secreto de verdad). */
export function hashContrasena(texto: string, sal: string): string {
  return createHash('sha256').update(sal + ':' + texto).digest('hex');
}
export function contrasenaClienteCorrecta(intento: string, sal: string, hashGuardado: string): boolean {
  return igual(hashContrasena(intento, sal), hashGuardado);
}

/** Sesión de UN cliente del portal: la cookie firma su propio id, así que no sirve para
 *  entrar a la página de otro cliente aunque se copie o se adivine el token de la URL. */
export function valorCookieCliente(clienteId: string): string {
  const exp = vencimiento();
  return `${clienteId}.${exp}.${firmar(`cliente:${clienteId}:${exp}`)}`;
}
export function clienteAutenticado(cookies: AstroCookies, clienteId: string): boolean {
  const [id, exp, firma] = (cookies.get(COOKIE_CLIENTE)?.value ?? '').split('.');
  if (id !== clienteId) return false;
  return firmaVigente(exp, firma, (e) => `cliente:${clienteId}:${e}`);
}
