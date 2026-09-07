import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cliente: SupabaseClient | null = null;

/** Supabase muestra la URL como "https://xxx.supabase.co/rest/v1/" en su panel; el cliente JS
 *  necesita solo el origen. Se recorta cualquier ruta o barra final para que pegarla tal cual
 *  en Vercel no rompa todas las consultas en silencio. */
export function normalizarUrl(url: string): string {
  const limpia = url.trim();
  if (!limpia) return '';
  try { return new URL(limpia).origin; } catch { return limpia.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, ''); }
}

/** Cliente de Supabase para usar SOLO en el servidor (rutas /api/*, páginas con prerender=false):
 *  usa la service_role key, que puede saltarse RLS, y nunca debe llegar al navegador. */
export function sb(): SupabaseClient {
  if (!cliente) {
    // import.meta.env: en rutas de servidor, Astro lo respalda con process.env leído en cada
    // solicitud (no solo al compilar), así que funciona igual en local (.env) y en Vercel
    // (variables puestas en el panel, sin volver a desplegar).
    const url = normalizarUrl(import.meta.env.SUPABASE_URL || process.env.SUPABASE_URL || '');
    const key = (import.meta.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY || '').trim();
    if (!url || !key) throw new Error('Faltan SUPABASE_URL / SUPABASE_SERVICE_KEY');
    cliente = createClient(url, key, { auth: { persistSession: false } });
  }
  return cliente;
}

export function nuevoToken(): string {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => abc[b % abc.length]).join('');
}
export function nuevaSal(): string {
  return crypto.randomUUID();
}
