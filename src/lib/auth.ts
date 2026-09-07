/**
 * Sesión del panel privado de GEMPRO (/panel) y verificación de contraseña de cada cliente
 * en el portal (/c/[token]). Mismo esquema ya probado y endurecido en Kindra Project:
 * - Sin AUTH_SECRET (o con menos de 16 caracteres) nadie puede entrar, en vez de firmar la
 *   sesión con una clave fija y adivinable.
 * - Las comparaciones usan hash de tamaño fijo, no largo de cadena, para no filtrar por
 *   temporización cuánto mide la contraseña real.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { AstroCookies } from 'astro';

export const COOKIE = 'gp_sesion';

function secreto(): string {
  const s = (import.meta.env.AUTH_SECRET || process.env.AUTH_SECRET) || '';
  return s.length >= 16 ? s : '';
}

function firma(): string {
  return createHmac('sha256', secreto()).update('gempro-panel').digest('hex');
}

function igual(a: string, b: string): boolean {
  const h = (s: string) => createHash('sha256').update(s).digest();
  return timingSafeEqual(h(a), h(b));
}

export function contrasenaCorrecta(intento: string): boolean {
  const real = (import.meta.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD) || '';
  if (!secreto() || !real) return false;
  return igual(intento, real);
}

export function valorCookie(): string {
  return firma();
}

export function estaAutenticado(cookies: AstroCookies): boolean {
  if (!secreto()) return false;
  const c = cookies.get(COOKIE)?.value;
  if (!c) return false;
  return igual(c, firma());
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
const COOKIE_CLIENTE = 'gp_cliente';
function firmaCliente(clienteId: string): string {
  return createHmac('sha256', secreto()).update(`cliente:${clienteId}`).digest('hex');
}
export function valorCookieCliente(clienteId: string): string {
  return `${clienteId}.${firmaCliente(clienteId)}`;
}
export function clienteAutenticado(cookies: AstroCookies, clienteId: string): boolean {
  if (!secreto()) return false;
  const c = cookies.get(COOKIE_CLIENTE)?.value ?? '';
  const [id, firma] = c.split('.');
  if (id !== clienteId || !firma) return false;
  return igual(firma, firmaCliente(clienteId));
}
export { COOKIE_CLIENTE };
