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
import { createHash, createHmac, scryptSync, timingSafeEqual } from 'node:crypto';
import type { AstroCookies } from 'astro';

export const COOKIE = 'gp_sesion';
export const COOKIE_CLIENTE = 'gp_cliente';
export const SESION_SEGUNDOS = 60 * 60 * 24 * 30;
// /entrar y el portal de clientes, sin marcar "recordar este dispositivo": la cookie no lleva
// Max-Age (se borra al cerrar el navegador del todo) y, por si acaso quedara abierta más tiempo
// del esperado, la propia firma deja de valer a las 8 horas.
const SESION_SIN_RECORDAR_SEGUNDOS = 60 * 60 * 8;

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

function vencimiento(segundos: number = SESION_SEGUNDOS): string {
  return String(Date.now() + segundos * 1000);
}

/** Opciones comunes de las cookies de sesión. `secure` cuando la petición llegó por https
 *  (siempre en Vercel); en local por http la cookie no se enviaría y no se podría entrar.
 *  `maxAge` en `undefined` deja la cookie sin Max-Age: el navegador la borra al cerrarse. */
export function opcionesCookie(url: URL, maxAge: number | undefined = SESION_SEGUNDOS) {
  return { httpOnly: true, sameSite: 'lax' as const, secure: url.protocol === 'https:', path: '/', maxAge };
}

export function contrasenaCorrecta(intento: string): boolean {
  // trim: un espacio o salto de línea pegado por accidente en el panel de Vercel no debe dejar fuera al equipo.
  const real = ((import.meta.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD) || '').trim();
  if (!secreto() || !real) return false;
  return igual(intento.trim(), real);
}

export function valorCookie(recordar: boolean = true): string {
  const exp = vencimiento(recordar ? SESION_SEGUNDOS : SESION_SIN_RECORDAR_SEGUNDOS);
  return `${exp}.${firmar('gempro-panel:' + exp)}`;
}

export function estaAutenticado(cookies: AstroCookies): boolean {
  const [exp, firma] = (cookies.get(COOKIE)?.value ?? '').split('.');
  return firmaVigente(exp, firma, (e) => 'gempro-panel:' + e);
}

/** Contraseña propia de cada cliente del portal: scrypt con sal aleatoria por cliente (no se
 *  reutiliza AUTH_SECRET aquí — cada cliente tiene su propio secreto de verdad). scrypt es
 *  lento a propósito: si la tabla se filtrara, un hash no se prueba por fuerza bruta en minutos
 *  como uno sha256 simple. El prefijo "scrypt$" distingue los hashes nuevos de los hashes
 *  sha256 de clientes creados antes de este cambio, que se siguen aceptando hasta que a ese
 *  cliente le cambien la contraseña (que ya guarda en el formato nuevo). */
export function hashContrasena(texto: string, sal: string): string {
  return 'scrypt$' + scryptSync(texto, sal, 32).toString('hex');
}
function hashContrasenaLegado(texto: string, sal: string): string {
  return createHash('sha256').update(sal + ':' + texto).digest('hex');
}
export function contrasenaClienteCorrecta(intento: string, sal: string, hashGuardado: string): boolean {
  const actual = hashGuardado.startsWith('scrypt$') ? hashContrasena(intento, sal) : hashContrasenaLegado(intento, sal);
  return igual(actual, hashGuardado);
}

/** Sesión de UN cliente del portal: la cookie firma su propio id, así que no sirve para
 *  entrar a la página de otro cliente aunque se copie o se adivine el token de la URL. */
/** La firma incluye la sal de la contraseña: al cambiarla (nueva sal) las sesiones abiertas dejan de valer.
 *  `recordar` en false usa la vigencia corta (ver SESION_SIN_RECORDAR_SEGUNDOS), para cuando la
 *  cookie no marca "recordar este dispositivo" y por eso tampoco lleva Max-Age. */
export function valorCookieCliente(clienteId: string, sal: string, recordar: boolean): string {
  const exp = vencimiento(recordar ? SESION_SEGUNDOS : SESION_SIN_RECORDAR_SEGUNDOS);
  return `${clienteId}.${exp}.${firmar(`cliente:${clienteId}:${sal}:${exp}`)}`;
}
export function clienteAutenticado(cookies: AstroCookies, clienteId: string, sal: string): boolean {
  const [id, exp, firma] = (cookies.get(COOKIE_CLIENTE)?.value ?? '').split('.');
  if (id !== clienteId) return false;
  return firmaVigente(exp, firma, (e) => `cliente:${clienteId}:${sal}:${e}`);
}
