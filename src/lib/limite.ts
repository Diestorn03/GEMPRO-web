/**
 * Límite de intentos por IP y ruta, guardado en la tabla `intentos_acceso` de Supabase (las
 * funciones de Vercel no comparten memoria entre peticiones, así que un contador en memoria no
 * serviría). Frena la fuerza bruta contra /api/entrar y /api/c/entrar y el spam a los
 * formularios públicos. Si la tabla no existe todavía, no bloquea a nadie y /api/salud lo avisa.
 */
import type { APIContext } from 'astro';
import { sb } from './supabase';

export function ipDe(ctx: APIContext): string {
  try { if (ctx.clientAddress) return ctx.clientAddress; } catch { /* sin petición real (p. ej. al compilar) */ }
  return ctx.request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'desconocida';
}

/** true si esa IP ya acumuló `max` intentos en `ruta` durante los últimos `minutos`. */
export async function bloqueado(ip: string, ruta: string, max = 10, minutos = 15): Promise<boolean> {
  const desde = new Date(Date.now() - minutos * 60_000).toISOString();
  const { count, error } = await sb().from('intentos_acceso').select('*', { count: 'exact', head: true }).eq('ip', ip).eq('ruta', ruta).gte('creado_en', desde);
  if (error) { console.error('[limite] no se pudo consultar intentos_acceso:', error.message); return false; }
  return (count ?? 0) >= max;
}

export async function registrarIntento(ip: string, ruta: string): Promise<void> {
  const { error } = await sb().from('intentos_acceso').insert({ ip, ruta });
  if (error) { console.error('[limite] no se pudo registrar el intento:', error.message); return; }
  // ponytail: limpieza oportunista (1 de cada 20 llamadas) en vez de un cron; la tabla se mantiene pequeña sola.
  if (Math.random() < 0.05) await sb().from('intentos_acceso').delete().lt('creado_en', new Date(Date.now() - 86_400_000).toISOString());
}
